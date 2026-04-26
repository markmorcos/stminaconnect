/**
 * NotificationService — the only path the rest of the app uses to dispatch
 * or react to notifications. The mock implementation in
 * `MockNotificationService.ts` writes to the Postgres `notifications`
 * table and listens to Supabase Realtime; the future real-push
 * implementation (phase 17) replaces the dispatcher without changing this
 * interface.
 */
import type { Notification, NotificationPayloadFor, NotificationType } from './types';

export interface DispatchArgs<T extends NotificationType = NotificationType> {
  recipientServantId: string;
  type: T;
  payload: NotificationPayloadFor<T>;
}

export type NotificationListener = (notification: Notification) => void;

export interface NotificationService {
  /**
   * Inserts a notification row server-side. In the mock implementation
   * this hits `dispatch_notification`; in the real one it also fans out
   * to Expo Push. Most production calls happen from Edge Functions —
   * this client-side path exists for tests and a small number of UI
   * actions.
   */
  dispatch<T extends NotificationType>(args: DispatchArgs<T>): Promise<string>;

  /**
   * Registers a listener invoked whenever a new notification arrives for
   * the current servant. Returns an unsubscribe function. Calling this
   * the first time also wires the underlying Realtime channel.
   */
  subscribe(listener: NotificationListener): () => void;

  /**
   * Marks a single notification as read for the current servant.
   */
  markRead(notificationId: string): Promise<void>;

  /**
   * Bulk marks every unread notification as read for the current servant.
   */
  markAllRead(): Promise<void>;

  /**
   * Refreshes the local store from the server. Called on mount and when
   * the inbox is pulled to refresh.
   */
  refresh(): Promise<void>;

  /**
   * Tears down active Realtime subscriptions. Called from
   * `NotificationServiceProvider` when the user signs out.
   */
  teardown(): Promise<void>;
}
