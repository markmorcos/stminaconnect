/**
 * Local-cache repository for `events`. Events are read-only on the
 * client; the SyncEngine populates this table from `sync_events_since`.
 */
import type { CalendarEvent } from '@/types/event';

import { getDatabase } from '../database';

interface EventRow {
  id: string;
  google_event_id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  is_counted: number;
  synced_at: string;
}

function rowToEvent(row: EventRow): CalendarEvent {
  return {
    id: row.id,
    google_event_id: row.google_event_id,
    title: row.title,
    description: row.description,
    start_at: row.start_at,
    end_at: row.end_at,
    is_counted: row.is_counted === 1,
    synced_at: row.synced_at,
  };
}

/**
 * Returns events whose `start_at` is between [00:00 today, 24:00 today)
 * in the device timezone — the same window the server's
 * `get_today_events` RPC produces, but evaluated locally so the screen
 * can render offline.
 */
export async function getTodayEvents(): Promise<CalendarEvent[]> {
  const db = await getDatabase();
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const rows = await db.getAllAsync<EventRow>(
    `SELECT * FROM events WHERE start_at >= ? AND start_at < ? ORDER BY start_at ASC`,
    [dayStart, dayEnd],
  );
  return rows.map(rowToEvent);
}

export async function getEvent(id: string): Promise<CalendarEvent | null> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<EventRow>(`SELECT * FROM events WHERE id = ? LIMIT 1`, [id]);
  return rows[0] ? rowToEvent(rows[0]) : null;
}

export async function upsertEvents(rows: readonly CalendarEvent[]): Promise<void> {
  if (rows.length === 0) return;
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const e of rows) {
      await db.runAsync(
        `INSERT INTO events (id, google_event_id, title, description, start_at, end_at, is_counted, synced_at, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced')
         ON CONFLICT(id) DO UPDATE SET
           google_event_id = excluded.google_event_id,
           title           = excluded.title,
           description     = excluded.description,
           start_at        = excluded.start_at,
           end_at          = excluded.end_at,
           is_counted      = excluded.is_counted,
           synced_at       = excluded.synced_at,
           sync_status     = 'synced'`,
        [
          e.id,
          e.google_event_id,
          e.title,
          e.description,
          e.start_at,
          e.end_at,
          e.is_counted ? 1 : 0,
          e.synced_at,
        ],
      );
    }
  });
}
