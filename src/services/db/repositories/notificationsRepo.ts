/**
 * Local-cache repository for `notifications`. The inbox reads from
 * here (newest first); SyncEngine populates it from
 * `sync_notifications_since`. `markRead` updates locally and enqueues
 * a `mark_notification_read` op.
 */
import {
  type Notification,
  type NotificationRow,
  notificationFromRow,
} from '@/services/notifications/types';

import { getDatabase } from '../database';

interface LocalRow {
  id: string;
  recipient_servant_id: string;
  type: string;
  payload: string;
  read_at: string | null;
  created_at: string;
}

function rowToNotification(row: LocalRow): Notification {
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(row.payload || '{}') as Record<string, unknown>;
  } catch {
    payload = {};
  }
  const serverRow: NotificationRow = {
    id: row.id,
    recipient_servant_id: row.recipient_servant_id,
    type: row.type as NotificationRow['type'],
    payload,
    read_at: row.read_at,
    created_at: row.created_at,
  };
  return notificationFromRow(serverRow);
}

export async function listNotifications(
  recipientServantId: string,
): Promise<{ inbox: Notification[]; unreadCount: number }> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<LocalRow>(
    `SELECT * FROM notifications WHERE recipient_servant_id = ? ORDER BY created_at DESC`,
    [recipientServantId],
  );
  const unread = await db.getAllAsync<{ c: number }>(
    `SELECT COUNT(*) AS c FROM notifications WHERE recipient_servant_id = ? AND read_at IS NULL`,
    [recipientServantId],
  );
  return {
    inbox: rows.map(rowToNotification),
    unreadCount: unread[0]?.c ?? 0,
  };
}

export async function upsertNotifications(rows: readonly NotificationRow[]): Promise<void> {
  if (rows.length === 0) return;
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const r of rows) {
      await db.runAsync(
        `INSERT INTO notifications (id, recipient_servant_id, type, payload, read_at, created_at, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, 'synced')
         ON CONFLICT(id) DO UPDATE SET
           recipient_servant_id = excluded.recipient_servant_id,
           type                 = excluded.type,
           payload              = excluded.payload,
           read_at              = excluded.read_at,
           created_at           = excluded.created_at,
           sync_status          = 'synced'`,
        [
          r.id,
          r.recipient_servant_id,
          r.type,
          JSON.stringify(r.payload ?? {}),
          r.read_at,
          r.created_at,
        ],
      );
    }
  });
}

export async function markRead(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE notifications SET read_at = ?, sync_status = 'pending' WHERE id = ? AND read_at IS NULL`,
    [new Date().toISOString(), id],
  );
}

/**
 * Inserts a system-only notification locally (no server round-trip).
 * Used by the SyncEngine when an op fails with a 4xx so the user gets
 * an inbox entry without waiting for the next pull. Idempotent on `id`.
 */
export async function insertLocalSystemNotification(args: {
  id: string;
  recipientServantId: string;
  message: string;
}): Promise<Notification> {
  const db = await getDatabase();
  const nowIso = new Date().toISOString();
  await db.runAsync(
    `INSERT OR IGNORE INTO notifications (id, recipient_servant_id, type, payload, read_at, created_at, sync_status)
     VALUES (?, ?, 'system', ?, NULL, ?, 'synced')`,
    [args.id, args.recipientServantId, JSON.stringify({ message: args.message }), nowIso],
  );
  return notificationFromRow({
    id: args.id,
    recipient_servant_id: args.recipientServantId,
    type: 'system',
    payload: { message: args.message },
    read_at: null,
    created_at: nowIso,
  });
}
