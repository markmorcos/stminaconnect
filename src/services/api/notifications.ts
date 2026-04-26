/**
 * Local-first notifications API. The inbox screen reads from here; the
 * SyncEngine populates the SQLite mirror via `sync_notifications_since`.
 * `markRead` updates locally and enqueues a `mark_notification_read`
 * op. Realtime INSERT events from `MockNotificationService` continue
 * to flow into the in-memory Zustand store as before — they're an
 * orthogonal push channel that the SyncEngine catches up via the next
 * pull anyway.
 */
import {
  listNotifications as repoList,
  markRead as repoMarkRead,
} from '@/services/db/repositories/notificationsRepo';
import { enqueue } from '@/services/db/repositories/queueRepo';
import { getSyncEngine } from '@/services/sync/SyncEngine';
import type { Notification } from '@/services/notifications/types';

export async function listNotifications(
  recipientServantId: string,
): Promise<{ inbox: Notification[]; unreadCount: number }> {
  return repoList(recipientServantId);
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await repoMarkRead(notificationId);
  await enqueue({
    op_type: 'mark_notification_read',
    payload: { notification_id: notificationId },
  });
  getSyncEngine().kick();
}
