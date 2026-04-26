/**
 * Tiny key/value accessor for `sync_meta`. Used for `last_pull_at`,
 * but generic enough that future flags don't need their own table.
 */
import { getDatabase } from '../database';

export async function getMeta(key: string): Promise<string | null> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ value: string | null }>(
    `SELECT value FROM sync_meta WHERE key = ?`,
    [key],
  );
  return rows[0]?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO sync_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}
