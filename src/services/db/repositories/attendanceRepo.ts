/**
 * Local-cache repository for `attendance`. The roster screen reads
 * present-set + audit fields from here. `markPresent` /
 * `unmarkPresent` apply the change locally; the SyncEngine drains
 * the corresponding queue ops.
 *
 * Composite primary key (event_id, person_id) matches the server's
 * unique constraint and makes upsert idempotent.
 */
import type { EventAttendanceRow } from '@/types/attendance';

import { getDatabase } from '../database';

interface AttendanceRow {
  event_id: string;
  person_id: string;
  marked_by: string;
  marked_at: string;
  sync_status: string;
}

function rowToAttendance(row: AttendanceRow): EventAttendanceRow {
  return {
    person_id: row.person_id,
    marked_by: row.marked_by,
    marked_at: row.marked_at,
  };
}

export async function getEventAttendance(eventId: string): Promise<EventAttendanceRow[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<AttendanceRow>(`SELECT * FROM attendance WHERE event_id = ?`, [
    eventId,
  ]);
  return rows.map(rowToAttendance);
}

export async function markPresent(
  eventId: string,
  personIds: readonly string[],
  markedBy: string,
): Promise<void> {
  if (personIds.length === 0) return;
  const db = await getDatabase();
  const nowIso = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    for (const personId of personIds) {
      await db.runAsync(
        `INSERT INTO attendance (event_id, person_id, marked_by, marked_at, sync_status)
         VALUES (?, ?, ?, ?, 'pending')
         ON CONFLICT(event_id, person_id) DO UPDATE SET
           marked_by   = excluded.marked_by,
           marked_at   = excluded.marked_at,
           sync_status = 'pending'`,
        [eventId, personId, markedBy, nowIso],
      );
    }
  });
}

export async function unmarkPresent(eventId: string, personIds: readonly string[]): Promise<void> {
  if (personIds.length === 0) return;
  const db = await getDatabase();
  const placeholders = personIds.map(() => '?').join(', ');
  await db.runAsync(
    `DELETE FROM attendance WHERE event_id = ? AND person_id IN (${placeholders})`,
    [eventId, ...personIds],
  );
}

interface ServerAttendanceUpsert {
  kind: 'upsert';
  event_id: string;
  person_id: string;
  marked_by: string;
  marked_at: string;
}

interface ServerAttendanceDelete {
  kind: 'delete';
  event_id: string;
  person_id: string;
}

export type ServerAttendanceRow = ServerAttendanceUpsert | ServerAttendanceDelete;

/**
 * Applies pulled rows from `sync_attendance_since`. Upsert sets
 * sync_status='synced'; delete removes the local row.
 */
export async function applyServerRows(rows: readonly ServerAttendanceRow[]): Promise<void> {
  if (rows.length === 0) return;
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const r of rows) {
      if (r.kind === 'upsert') {
        await db.runAsync(
          `INSERT INTO attendance (event_id, person_id, marked_by, marked_at, sync_status)
           VALUES (?, ?, ?, ?, 'synced')
           ON CONFLICT(event_id, person_id) DO UPDATE SET
             marked_by   = excluded.marked_by,
             marked_at   = excluded.marked_at,
             sync_status = 'synced'`,
          [r.event_id, r.person_id, r.marked_by, r.marked_at],
        );
      } else {
        await db.runAsync(`DELETE FROM attendance WHERE event_id = ? AND person_id = ?`, [
          r.event_id,
          r.person_id,
        ]);
      }
    }
  });
}

/**
 * Replaces a temp person_id with a server-assigned id in attendance
 * rows. Used after `create_person` resolves a temp_id.
 */
export async function rewriteAttendancePersonId(tempId: string, realId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`UPDATE attendance SET person_id = ? WHERE person_id = ?`, [realId, tempId]);
}
