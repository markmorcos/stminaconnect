/**
 * Singleton accessor for the local SQLite database used by the
 * SyncEngine and the per-table repositories. Keeping a single instance
 * keeps writers serialized and matches expo-sqlite's recommended usage
 * (see `withTransactionAsync` semantics).
 *
 * The DB is opened lazily on first call. Tests inject a fake via
 * `__setDatabaseForTests`.
 */
import * as SQLite from 'expo-sqlite';

import { runMigrations } from './migrator';

export const DATABASE_NAME = 'stmina.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.execAsync('PRAGMA journal_mode = WAL;');
    await db.execAsync('PRAGMA foreign_keys = ON;');
    await runMigrations(db);
    return db;
  })();
  return dbPromise;
}

/**
 * For unit tests. Replaces the singleton with a pre-built in-memory DB
 * (no migrator run inside getDatabase). Pass `null` to reset.
 */
export function __setDatabaseForTests(db: SQLite.SQLiteDatabase | null): void {
  dbPromise = db ? Promise.resolve(db) : null;
}

/**
 * Closes the singleton DB, deletes the file from disk, and resets the
 * cached promise so the next `getDatabase()` reopens with a fresh
 * schema (migrations re-run on the empty file).
 *
 * Caller should also reset any in-memory state that mirrors the DB
 * (zustand stores) and re-trigger the SyncEngine for a full pull.
 *
 * Dev-only: invoked from the `/dev/db` inspector. Not safe to call
 * while writes are in flight.
 */
export async function wipeLocalDatabase(): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      await db.closeAsync();
    } catch {
      // best effort — fall through to the delete so a half-broken
      // connection still gets cleaned up.
    }
  }
  dbPromise = null;
  await SQLite.deleteDatabaseAsync(DATABASE_NAME);
}
