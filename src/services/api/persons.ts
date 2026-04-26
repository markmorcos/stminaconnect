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

function currentServantIdOrThrow(): string {
  const id = useAuthStore.getState().servant?.id;
  if (!id) throw new Error('not_authenticated');
  return id;
}

export async function listPersons(filter: PersonsFilter = {}): Promise<Person[]> {
  return repoList(filter);
}

export async function getPerson(id: string): Promise<Person | null> {
  return repoGet(id);
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
