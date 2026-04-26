/**
 * Local-cache repository for `persons`. Reads come from here; writes
 * go through the SyncEngine which calls back into `upsertPersons`
 * after a successful pull or push.
 *
 * `comments` visibility is decided server-side and projected into the
 * local row by `sync_persons_since`. We trust the cache: if the local
 * row has `comments=null`, the comments are hidden.
 */
import type { Person, PersonsFilter } from '@/types/person';

import { getDatabase } from '../database';

interface PersonRow {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  region: string | null;
  language: string;
  priority: string;
  assigned_servant: string;
  comments: string | null;
  status: string;
  paused_until: string | null;
  registration_type: string;
  registered_by: string;
  registered_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
}

function rowToPerson(row: PersonRow): Person {
  return {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    phone: row.phone,
    region: row.region,
    language: row.language as Person['language'],
    priority: row.priority as Person['priority'],
    assigned_servant: row.assigned_servant,
    comments: row.comments,
    status: row.status as Person['status'],
    paused_until: row.paused_until,
    registration_type: row.registration_type as Person['registration_type'],
    registered_by: row.registered_by,
    registered_at: row.registered_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

export async function listPersons(filter: PersonsFilter = {}): Promise<Person[]> {
  const db = await getDatabase();
  const where: string[] = ['deleted_at IS NULL'];
  const params: unknown[] = [];
  if (filter.assigned_servant) {
    where.push('assigned_servant = ?');
    params.push(filter.assigned_servant);
  }
  if (filter.region) {
    where.push('region = ?');
    params.push(filter.region);
  }
  if (filter.status) {
    where.push('status = ?');
    params.push(filter.status);
  }
  if (filter.search) {
    where.push('(first_name LIKE ? OR last_name LIKE ?)');
    const like = `%${filter.search}%`;
    params.push(like, like);
  }
  const rows = await db.getAllAsync<PersonRow>(
    `SELECT * FROM persons WHERE ${where.join(' AND ')} ORDER BY last_name, first_name`,
    params as never[],
  );
  return rows.map(rowToPerson);
}

export async function getPerson(id: string): Promise<Person | null> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<PersonRow>(
    `SELECT * FROM persons WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [id],
  );
  return rows[0] ? rowToPerson(rows[0]) : null;
}

const PERSON_COLUMNS = [
  'id',
  'first_name',
  'last_name',
  'phone',
  'region',
  'language',
  'priority',
  'assigned_servant',
  'comments',
  'status',
  'paused_until',
  'registration_type',
  'registered_by',
  'registered_at',
  'created_at',
  'updated_at',
  'deleted_at',
] as const;

export async function upsertPersons(
  rows: readonly Person[],
  syncStatus: 'synced' | 'pending' = 'synced',
): Promise<void> {
  if (rows.length === 0) return;
  const db = await getDatabase();
  const placeholders = PERSON_COLUMNS.map(() => '?').join(', ');
  const updateSet = PERSON_COLUMNS.filter((c) => c !== 'id')
    .map((c) => `${c} = excluded.${c}`)
    .join(', ');
  await db.withTransactionAsync(async () => {
    for (const r of rows) {
      const params = [
        r.id,
        r.first_name,
        r.last_name,
        r.phone,
        r.region,
        r.language,
        r.priority,
        r.assigned_servant,
        r.comments,
        r.status,
        r.paused_until,
        r.registration_type,
        r.registered_by,
        r.registered_at,
        r.created_at,
        r.updated_at,
        r.deleted_at,
      ];
      await db.runAsync(
        `INSERT INTO persons (${PERSON_COLUMNS.join(', ')}, sync_status)
         VALUES (${placeholders}, ?)
         ON CONFLICT(id) DO UPDATE SET ${updateSet}, sync_status = excluded.sync_status`,
        [...params, syncStatus],
      );
    }
  });
}

export async function softDeletePersons(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDatabase();
  const placeholders = ids.map(() => '?').join(', ');
  const nowIso = new Date().toISOString();
  await db.runAsync(
    `UPDATE persons SET deleted_at = ?, updated_at = ? WHERE id IN (${placeholders})`,
    [nowIso, nowIso, ...ids],
  );
}

/**
 * Replaces a temp_id with a server-assigned id everywhere it appears
 * in the local persons table. Used by the SyncEngine after a
 * `create_person` op succeeds.
 */
export async function rewritePersonId(tempId: string, realId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`UPDATE persons SET id = ?, sync_status = 'synced' WHERE id = ?`, [
    realId,
    tempId,
  ]);
}
