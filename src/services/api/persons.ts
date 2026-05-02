/**
 * Local-first persons API. Reads come from the SQLite mirror populated
 * by the SyncEngine; writes update the local row optimistically and
 * enqueue an op into `local_sync_queue`. The screens' contract is
 * unchanged: same function names, same return shapes — but `createPerson`
 * now returns a `temp_id` (UUIDv4 generated locally) that the SyncEngine
 * rewrites to the server id once `create_person` succeeds.
 *
 * All mutations require an authenticated servant: the local row uses
 * the current `servant.id` for `assigned_servant`, `registered_by`, and
 * `marked_by` so the cache is consistent before the server round-trip.
 */
import {
  listPersons as repoList,
  getPerson as repoGet,
  rewritePersonId,
  softDeletePersons,
  upsertPersons,
} from '@/services/db/repositories/personsRepo';
import { enqueue } from '@/services/db/repositories/queueRepo';
import { getSyncEngine } from '@/services/sync/SyncEngine';
import { useAuthStore } from '@/state/authStore';
import type {
  Person,
  PersonCreatePayload,
  PersonUpdatePayload,
  PersonsFilter,
} from '@/types/person';

import { getDatabase } from '../db/database';
import { supabase } from './supabase';

function currentServantIdOrThrow(): string {
  const id = useAuthStore.getState().servant?.id;
  if (!id) throw new Error('not_authenticated');
  return id;
}

/**
 * Network-first: fetches the visibility-filtered persons set from the
 * server (`sync_persons_since` with `since=null` = full snapshot),
 * upserts the result into the SQLite mirror so the next offline read
 * has it, and applies the screen-side filter client-side. Falls back to
 * the SQLite mirror when the network call fails (offline, auth lag,
 * RPC error, etc.).
 *
 * Why network-first: the SyncEngine's incremental pull (since=watermark)
 * can race with first-launch auth propagation — if the very first pull
 * fires before the supabase client's session header is fully attached,
 * the RPC returns 0 rows under server-side visibility filtering, the
 * watermark advances anyway, and subsequent incremental pulls never
 * re-fetch the missed rows. Reading from the server on every list-mount
 * sidesteps that race entirely, costs ~one round-trip per screen open
 * (cheap for a parish-sized dataset), and keeps SQLite in sync as a
 * proper offline cache.
 */
export async function listPersons(filter: PersonsFilter = {}): Promise<Person[]> {
  try {
    const { data, error } = await supabase.rpc('sync_persons_since', { since: null });
    if (error) throw error;
    const all = (data ?? []) as Person[];
    if (all.length > 0) {
      await upsertPersons(all, 'synced');
    }
    return applyPersonsFilter(
      all.filter((r) => r.deleted_at == null),
      filter,
    );
  } catch {
    // Network / auth / RPC failure → serve from the SQLite mirror so
    // the screen still renders something useful when offline.
    return repoList(filter);
  }
}

function applyPersonsFilter(rows: readonly Person[], filter: PersonsFilter): Person[] {
  let out = rows.slice();
  if (filter.assigned_servant) {
    out = out.filter((r) => r.assigned_servant === filter.assigned_servant);
  }
  if (filter.region) {
    out = out.filter((r) => r.region === filter.region);
  }
  if (filter.status) {
    out = out.filter((r) => r.status === filter.status);
  }
  if (filter.search) {
    const needle = filter.search.toLowerCase();
    out = out.filter(
      (r) =>
        r.first_name.toLowerCase().includes(needle) || r.last_name.toLowerCase().includes(needle),
    );
  }
  out.sort(
    (a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name),
  );
  return out;
}

/**
 * Reads the local SQLite mirror first; on cache miss, falls back to the
 * `get_person` RPC and writes the result into the local mirror so
 * subsequent reads stay offline.
 *
 * The fallback exists because deep links (notifications, future
 * push-to-profile flows) can target a person whose row has not yet
 * been pulled by the SyncEngine — for example on a fresh install
 * where the initial pull is still in flight, or after a sync gap. The
 * project architecture (project.md §6.4) calls for this fall-through
 * pattern.
 */
export async function getPerson(id: string): Promise<Person | null> {
  const local = await repoGet(id);
  if (local) return local;

  const { data, error } = await supabase.rpc('get_person', { person_id: id });
  if (error) throw error;
  if (!data || (data as { id?: string }).id == null) return null;

  const row = data as Person;
  if (row.deleted_at) return null;

  // Cache locally so the next read hits SQLite. The sync engine will
  // re-overwrite this row on its next pull with whatever the server
  // says — if the row was visible to us via get_person, sync_persons_since
  // will surface it too once the watermark catches up.
  await upsertPersons([row], 'synced');
  return row;
}

export async function createPerson(payload: PersonCreatePayload): Promise<string> {
  const tempId = `temp-${cryptoRandomUuid()}`;
  const servantId = currentServantIdOrThrow();
  const nowIso = new Date().toISOString();
  const optimisticRow: Person = {
    id: tempId,
    first_name: payload.first_name,
    last_name: payload.last_name,
    phone: payload.phone ?? null,
    region: payload.region ?? null,
    language: payload.language,
    priority: payload.priority ?? 'medium',
    assigned_servant: payload.assigned_servant ?? servantId,
    comments: payload.comments ?? null,
    status: payload.status ?? 'new',
    paused_until: payload.paused_until ?? null,
    registration_type: payload.registration_type,
    registered_by: servantId,
    registered_at: nowIso,
    created_at: nowIso,
    updated_at: nowIso,
    deleted_at: null,
  };
  await upsertPersons([optimisticRow], 'pending');
  await enqueue({ op_type: 'create_person', payload: { payload }, temp_id: tempId });
  getSyncEngine().kick();
  return tempId;
}

export async function updatePerson(id: string, payload: PersonUpdatePayload): Promise<Person> {
  const existing = await repoGet(id);
  if (!existing) throw new Error('person_not_found');
  const merged: Person = {
    ...existing,
    ...payload,
    updated_at: new Date().toISOString(),
  };
  await upsertPersons([merged], 'pending');
  await enqueue({
    op_type: 'update_person',
    payload: { person_id: id, payload },
  });
  getSyncEngine().kick();
  return merged;
}

export async function assignPerson(id: string, servantId: string, reason: string): Promise<void> {
  const existing = await repoGet(id);
  if (existing) {
    await upsertPersons(
      [{ ...existing, assigned_servant: servantId, updated_at: new Date().toISOString() }],
      'pending',
    );
  }
  await enqueue({
    op_type: 'assign_person',
    payload: { person_id: id, servant_id: servantId, reason },
  });
  getSyncEngine().kick();
}

export async function softDeletePerson(id: string): Promise<void> {
  await softDeletePersons([id]);
  await enqueue({ op_type: 'soft_delete_person', payload: { person_id: id } });
  getSyncEngine().kick();
}

/**
 * Local soft-duplicate detector. Matches on case-insensitive
 * first+last+phone within the local cache; first hit wins. The remote
 * `find_potential_duplicate` is no longer consulted because the
 * Quick Add flow needs to work offline.
 */
export async function findPotentialDuplicate(
  first: string,
  last: string,
  phone: string,
): Promise<string | null> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM persons
      WHERE deleted_at IS NULL
        AND lower(first_name) = lower(?)
        AND lower(last_name)  = lower(?)
        AND COALESCE(phone, '') = ?
      LIMIT 1`,
    [first.trim(), last.trim(), phone.trim()],
  );
  return rows[0]?.id ?? null;
}

/**
 * Tiny RFC4122-v4 generator. Inlined to avoid a `uuid` dependency for
 * the temp_id case (it's the only place we mint ids client-side).
 * Falls back to crypto.getRandomValues when available; otherwise to
 * Math.random which is acceptable for collision-resistance at our
 * scale (<1k temp ids per device per session).
 */
function cryptoRandomUuid(): string {
  const g = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto;
  if (g?.randomUUID) return g.randomUUID();
  // RFC4122-ish fallback.
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Re-exposed for the SyncEngine; not used by screens directly. */
export { rewritePersonId };
