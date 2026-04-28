/**
 * Local-cache repository for `local_sync_queue`. The queue is the
 * single source of truth for pending writes: the SyncEngine's
 * `push()` peeks the head, dispatches the op, and dequeues on
 * success. Status flips between 'pending' (drain candidate),
 * 'in_flight' (currently dispatching) and 'needs_attention' (4xx).
 */
import { getDatabase } from '../database';

export type SyncOpType =
  | 'mark_attendance'
  | 'unmark_attendance'
  | 'create_person'
  | 'update_person'
  | 'soft_delete_person'
  | 'assign_person'
  | 'mark_notification_read';

export type QueueOpStatus = 'pending' | 'in_flight' | 'needs_attention';

export interface QueueOp {
  id: number;
  op_type: SyncOpType;
  /** Parsed JSON payload. */
  payload: Record<string, unknown>;
  created_at: number;
  attempts: number;
  last_error: string | null;
  status: QueueOpStatus;
  next_attempt_at: number;
  temp_id: string | null;
}

interface RawRow {
  id: number;
  op_type: string;
  payload: string;
  created_at: number;
  attempts: number;
  last_error: string | null;
  status: string;
  next_attempt_at: number;
  temp_id: string | null;
}

function rowToOp(row: RawRow): QueueOp {
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(row.payload) as Record<string, unknown>;
  } catch {
    payload = {};
  }
  return {
    id: row.id,
    op_type: row.op_type as SyncOpType,
    payload,
    created_at: row.created_at,
    attempts: row.attempts,
    last_error: row.last_error,
    status: row.status as QueueOpStatus,
    next_attempt_at: row.next_attempt_at,
    temp_id: row.temp_id,
  };
}

export interface EnqueueArgs {
  op_type: SyncOpType;
  payload: Record<string, unknown>;
  /** Required for `create_person`; carried on subsequent ops referencing it. */
  temp_id?: string;
}

export async function enqueue(args: EnqueueArgs): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO local_sync_queue (op_type, payload, created_at, temp_id)
     VALUES (?, ?, ?, ?)`,
    [args.op_type, JSON.stringify(args.payload), Date.now(), args.temp_id ?? null],
  );
  return result.lastInsertRowId as number;
}

/** Returns the next op eligible to dispatch (pending, not waiting on backoff). */
export async function peek(now: number = Date.now()): Promise<QueueOp | null> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<RawRow>(
    `SELECT * FROM local_sync_queue
      WHERE status = 'pending' AND next_attempt_at <= ?
      ORDER BY id ASC
      LIMIT 1`,
    [now],
  );
  return rows[0] ? rowToOp(rows[0]) : null;
}

export async function dequeue(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM local_sync_queue WHERE id = ?`, [id]);
}

export async function length(): Promise<number> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ c: number }>(`SELECT COUNT(*) AS c FROM local_sync_queue`);
  return rows[0]?.c ?? 0;
}

/**
 * Number of ops still in `status='pending'` (i.e. drainable on the
 * next push attempt, regardless of `next_attempt_at`). Used by the
 * engine to decide whether to schedule another retry tick.
 */
export async function pendingLength(): Promise<number> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ c: number }>(
    `SELECT COUNT(*) AS c FROM local_sync_queue WHERE status = 'pending'`,
  );
  return rows[0]?.c ?? 0;
}

/**
 * Soonest `next_attempt_at` among pending ops, or null when no pending
 * op exists. Lets the engine schedule its retry timer at the most
 * useful instant rather than a fixed interval.
 */
export async function nextPendingAttemptAt(): Promise<number | null> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ next: number | null }>(
    `SELECT MIN(next_attempt_at) AS next FROM local_sync_queue WHERE status = 'pending'`,
  );
  const v = rows[0]?.next;
  return typeof v === 'number' ? v : null;
}

export async function listAll(): Promise<QueueOp[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<RawRow>(`SELECT * FROM local_sync_queue ORDER BY id ASC`);
  return rows.map(rowToOp);
}

/** Rows the engine has parked because of a 4xx — surfaced to /sync-issues. */
export async function listNeedsAttention(): Promise<QueueOp[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<RawRow>(
    `SELECT * FROM local_sync_queue WHERE status = 'needs_attention' ORDER BY id ASC`,
  );
  return rows.map(rowToOp);
}

/** Discards a parked op — used by the /sync-issues screen "Discard" button. */
export async function discardOp(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM local_sync_queue WHERE id = ?`, [id]);
}

/**
 * Backoff schedule: 5s, 15s, 60s, 300s, 600s (capped). Index = attempts
 * already taken. Used by `markAttempt` to compute `next_attempt_at`.
 */
export const BACKOFF_SCHEDULE_MS = [5_000, 15_000, 60_000, 300_000, 600_000] as const;

export function backoffFor(attempts: number): number {
  const idx = Math.min(attempts, BACKOFF_SCHEDULE_MS.length - 1);
  return BACKOFF_SCHEDULE_MS[idx];
}

export async function markAttempt(
  id: number,
  error: string,
  now: number = Date.now(),
): Promise<void> {
  const db = await getDatabase();
  // Atomic: increment attempts, write last_error, schedule next attempt.
  await db.runAsync(
    `UPDATE local_sync_queue
        SET attempts = attempts + 1,
            last_error = ?,
            status = 'pending',
            next_attempt_at = ? + (
              CASE
                WHEN attempts >= ${BACKOFF_SCHEDULE_MS.length - 1} THEN ${BACKOFF_SCHEDULE_MS[BACKOFF_SCHEDULE_MS.length - 1]}
                ${BACKOFF_SCHEDULE_MS.map((ms, i) => `WHEN attempts = ${i} THEN ${ms}`).join(
                  '\n                ',
                )}
                ELSE ${BACKOFF_SCHEDULE_MS[BACKOFF_SCHEDULE_MS.length - 1]}
              END
            )
      WHERE id = ?`,
    [error, now, id],
  );
}

export async function markNeedsAttention(id: number, error: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE local_sync_queue SET status = 'needs_attention', last_error = ? WHERE id = ?`,
    [error, id],
  );
}

export async function clearQueue(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM local_sync_queue`);
}

/**
 * Resets `next_attempt_at = 0` on every pending op so the next push
 * drains them immediately. Called by the SyncEngine when the device
 * reconnects — at that point any backoff window is moot because the
 * reason for the backoff (network) just went away.
 */
export async function resetPendingBackoffs(): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `UPDATE local_sync_queue SET next_attempt_at = 0 WHERE status = 'pending'`,
    [],
  );
  return result.changes ?? 0;
}

/**
 * Rewrites a temp_id reference to a real server id across queued ops.
 * Walks payloads and replaces any value equal to `tempId` with
 * `realId`. Used after `create_person` succeeds.
 */
export async function rewriteTempId(tempId: string, realId: string): Promise<void> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<RawRow>(
    `SELECT * FROM local_sync_queue WHERE temp_id = ? OR payload LIKE ?`,
    [tempId, `%${tempId}%`],
  );
  for (const row of rows) {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(row.payload) as Record<string, unknown>;
    } catch {
      continue;
    }
    const rewritten = rewriteValue(payload, tempId, realId) as Record<string, unknown>;
    await db.runAsync(`UPDATE local_sync_queue SET payload = ?, temp_id = NULL WHERE id = ?`, [
      JSON.stringify(rewritten),
      row.id,
    ]);
  }
}

function rewriteValue(value: unknown, from: string, to: string): unknown {
  if (typeof value === 'string') return value === from ? to : value;
  if (Array.isArray(value)) return value.map((v) => rewriteValue(v, from, to));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = rewriteValue(v, from, to);
    }
    return out;
  }
  return value;
}
