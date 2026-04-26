/**
 * Tiny in-memory simulation of the subset of expo-sqlite we use in
 * the queue/sync layer. NOT a SQL parser — it pattern-matches the
 * specific statements the repositories emit.
 *
 * Tables: `local_sync_queue`, `sync_meta`, `persons`, `notifications`,
 * `attendance`, `events`. Add cases as needed when new tests land.
 */

interface RunResult {
  lastInsertRowId: number;
  changes: number;
}

interface QueueRow {
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

export class FakeQueueDb {
  queue: QueueRow[] = [];
  meta: Record<string, string> = {};
  private nextId = 1;

  async execAsync(_sql: string): Promise<void> {
    /* no-op for CREATE TABLE etc. */
    void _sql;
  }

  async withTransactionAsync(fn: () => Promise<void>): Promise<void> {
    await fn();
  }

  async runAsync(sql: string, params: unknown[]): Promise<RunResult> {
    const norm = sql.replace(/\s+/g, ' ').trim();
    if (norm.startsWith('INSERT INTO local_sync_queue')) {
      const [op_type, payload, created_at, temp_id] = params as [
        string,
        string,
        number,
        string | null,
      ];
      const row: QueueRow = {
        id: this.nextId++,
        op_type,
        payload,
        created_at,
        attempts: 0,
        last_error: null,
        status: 'pending',
        next_attempt_at: 0,
        temp_id: temp_id ?? null,
      };
      this.queue.push(row);
      return { lastInsertRowId: row.id, changes: 1 };
    }
    if (norm.startsWith('DELETE FROM local_sync_queue WHERE id = ?')) {
      const [id] = params as [number];
      const before = this.queue.length;
      this.queue = this.queue.filter((r) => r.id !== id);
      return { lastInsertRowId: 0, changes: before - this.queue.length };
    }
    if (norm.startsWith('DELETE FROM local_sync_queue')) {
      const before = this.queue.length;
      this.queue = [];
      return { lastInsertRowId: 0, changes: before };
    }
    if (norm.startsWith('UPDATE local_sync_queue SET attempts = attempts + 1')) {
      const [last_error, now, id] = params as [string, number, number];
      const row = this.queue.find((r) => r.id === id);
      if (row) {
        row.attempts += 1;
        row.last_error = last_error;
        row.status = 'pending';
        // Mirror the embedded CASE in queueRepo: 5/15/60/300/600s
        const sched = [5_000, 15_000, 60_000, 300_000, 600_000];
        const idx = Math.min(row.attempts - 1, sched.length - 1);
        row.next_attempt_at = now + sched[idx];
      }
      return { lastInsertRowId: 0, changes: row ? 1 : 0 };
    }
    if (norm.startsWith("UPDATE local_sync_queue SET status = 'needs_attention'")) {
      const [last_error, id] = params as [string, number];
      const row = this.queue.find((r) => r.id === id);
      if (row) {
        row.status = 'needs_attention';
        row.last_error = last_error;
      }
      return { lastInsertRowId: 0, changes: row ? 1 : 0 };
    }
    if (
      norm.startsWith("UPDATE local_sync_queue SET next_attempt_at = 0 WHERE status = 'pending'")
    ) {
      let changes = 0;
      for (const row of this.queue) {
        if (row.status === 'pending') {
          row.next_attempt_at = 0;
          changes++;
        }
      }
      return { lastInsertRowId: 0, changes };
    }
    if (norm.startsWith('UPDATE local_sync_queue SET payload = ?, temp_id = NULL')) {
      const [payload, id] = params as [string, number];
      const row = this.queue.find((r) => r.id === id);
      if (row) {
        row.payload = payload;
        row.temp_id = null;
      }
      return { lastInsertRowId: 0, changes: row ? 1 : 0 };
    }
    if (norm.startsWith('INSERT INTO sync_meta')) {
      const [key, value] = params as [string, string];
      this.meta[key] = value;
      return { lastInsertRowId: 0, changes: 1 };
    }
    throw new Error(`FakeQueueDb: unsupported runAsync statement: ${norm}`);
  }

  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const norm = sql.replace(/\s+/g, ' ').trim();
    if (norm.includes('FROM local_sync_queue')) {
      // peek
      if (norm.includes("WHERE status = 'pending' AND next_attempt_at <= ?")) {
        const [now] = params as [number];
        const candidates = this.queue
          .filter((r) => r.status === 'pending' && r.next_attempt_at <= now)
          .sort((a, b) => a.id - b.id);
        return [candidates[0]].filter(Boolean) as T[];
      }
      if (norm.startsWith("SELECT COUNT(*) AS c FROM local_sync_queue WHERE status = 'pending'")) {
        const c = this.queue.filter((r) => r.status === 'pending').length;
        return [{ c }] as unknown as T[];
      }
      if (norm.startsWith('SELECT COUNT(*) AS c FROM local_sync_queue')) {
        return [{ c: this.queue.length }] as unknown as T[];
      }
      if (
        norm.startsWith(
          "SELECT MIN(next_attempt_at) AS next FROM local_sync_queue WHERE status = 'pending'",
        )
      ) {
        const pending = this.queue.filter((r) => r.status === 'pending');
        const next =
          pending.length === 0
            ? null
            : pending.reduce(
                (m, r) => (m === null || r.next_attempt_at < m ? r.next_attempt_at : m),
                null as number | null,
              );
        return [{ next }] as unknown as T[];
      }
      if (norm.startsWith('SELECT * FROM local_sync_queue WHERE temp_id = ? OR payload LIKE ?')) {
        const [tempId, like] = params as [string, string];
        const needle = like.replace(/%/g, '');
        const matches = this.queue.filter(
          (r) => r.temp_id === tempId || r.payload.includes(needle),
        );
        return matches as T[];
      }
      if (norm.startsWith('SELECT * FROM local_sync_queue ORDER BY id ASC')) {
        return [...this.queue].sort((a, b) => a.id - b.id) as T[];
      }
    }
    if (norm.startsWith('SELECT value FROM sync_meta')) {
      const [key] = params as [string];
      return [{ value: this.meta[key] ?? null }] as unknown as T[];
    }
    throw new Error(`FakeQueueDb: unsupported getAllAsync statement: ${norm}`);
  }
}
