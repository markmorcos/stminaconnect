/**
 * Tiny in-house migration runner. Reads `sync_meta.schema_version`
 * (creating the row if missing), applies any migrations whose ordinal
 * is greater than the stored version, then writes the new version
 * back. Migrations are pure SQL strings exported by
 * `./migrations/*.ts`.
 *
 * Why not use a third-party migration library? We control the schema,
 * the migrations are tiny, and adding a dependency for a single SQL
 * file feels like overkill. The runner runs inside `getDatabase`
 * before any repository touches the DB.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { sql as migration001 } from './migrations/001_initial';

interface Migration {
  version: number;
  name: string;
  sql: string;
}

const MIGRATIONS: Migration[] = [{ version: 1, name: '001_initial', sql: migration001 }];

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  const rows = await db.getAllAsync<{ value: string | null }>(
    `SELECT value FROM sync_meta WHERE key = 'schema_version'`,
  );
  const current = rows[0] ? Number(rows[0].value ?? 0) : 0;

  const pending = MIGRATIONS.filter((m) => m.version > current).sort(
    (a, b) => a.version - b.version,
  );
  if (pending.length === 0) return;

  for (const m of pending) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(m.sql);
      await db.runAsync(
        `INSERT INTO sync_meta (key, value) VALUES ('schema_version', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [String(m.version)],
      );
    });
  }
}
