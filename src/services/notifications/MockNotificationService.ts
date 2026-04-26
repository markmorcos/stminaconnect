/**
 * MockNotificationService — phase-7 dispatcher.
 *
 * `dispatch` round-trips through the `dispatch_notification` RPC so the
 * notification persists in `public.notifications` and any subscribed
 * client (including the dispatcher itself) receives the Realtime INSERT.
 *
 * `subscribe` opens a Supabase Realtime channel filtered to the current
 * servant; on insert it pushes into the Zustand store and invokes any
 * external listeners. Sign-out tears the channel down via `teardown`.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/services/api/supabase';
import { useNotificationsStore } from '@/state/notificationsStore';

import type {
  DispatchArgs,
  NotificationListener,
  NotificationService,
} from './NotificationService';
import {
  notificationFromRow,
  type Notification,
  type NotificationRow,
  type NotificationType,
} from './types';

interface MockServiceOptions {
  /**
   * Returns the current servant id (or null when signed out). Allows
   * tests to drive the service without a real auth store.
   */
  getServantId: () => string | null;
}

export class MockNotificationService implements NotificationService {
  private readonly listeners = new Set<NotificationListener>();
  private channel: RealtimeChannel | null = null;
  private subscribedServantId: string | null = null;

  constructor(private readonly options: MockServiceOptions) {}

  async dispatch<T extends NotificationType>(args: DispatchArgs<T>): Promise<string> {
    const { data, error } = await supabase.rpc('dispatch_notification', {
      recipient: args.recipientServantId,
      type: args.type,
      payload: args.payload ?? {},
    });
    if (error) throw error;
    return data as string;
  }

  subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    void this.ensureChannel();
    return () => {
      this.listeners.delete(listener);
    };
  }

  async markRead(notificationId: string): Promise<void> {
    const { error } = await supabase.rpc('mark_notification_read', {
      notification_id: notificationId,
    });
    if (error) throw error;
    useNotificationsStore.getState().markRead(notificationId);
  }

  async markAllRead(): Promise<void> {
    const { error } = await supabase.rpc('mark_all_notifications_read');
    if (error) throw error;
    useNotificationsStore.getState().markAllRead();
  }

  async refresh(): Promise<void> {
    const servantId = this.options.getServantId();
    if (!servantId) {
      useNotificationsStore.getState().reset();
      return;
    }

    const [rowsResult, countResult] = await Promise.all([
      supabase
        .from('notifications')
        .select('*')
        .eq('recipient_servant_id', servantId)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.rpc('unread_notifications_count'),
    ]);

    if (rowsResult.error) throw rowsResult.error;
    if (countResult.error) throw countResult.error;

    const rows = (rowsResult.data ?? []) as NotificationRow[];
    const inbox = rows.map(notificationFromRow);
    const unread = (countResult.data as number | null) ?? 0;
    useNotificationsStore.getState().hydrate(inbox, unread);

    void this.ensureChannel();
  }

  async teardown(): Promise<void> {
    this.listeners.clear();
    if (this.channel) {
      await supabase.removeChannel(this.channel).catch(() => null);
      this.channel = null;
    }
    this.subscribedServantId = null;
    useNotificationsStore.getState().reset();
  }

  private async ensureChannel(): Promise<void> {
    const servantId = this.options.getServantId();
    if (!servantId) return;
    if (this.channel && this.subscribedServantId === servantId) return;

    if (this.channel) {
      await supabase.removeChannel(this.channel).catch(() => null);
      this.channel = null;
    }

    const channel = supabase
      .channel(`notifications:${servantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_servant_id=eq.${servantId}`,
        },
        (payload) => {
          const row = payload.new as NotificationRow;
          const notification = notificationFromRow(row);
          this.handleIncoming(notification);
        },
      )
      .subscribe();

    this.channel = channel;
    this.subscribedServantId = servantId;
  }

  private handleIncoming(notification: Notification): void {
    useNotificationsStore.getState().add(notification);
    for (const listener of this.listeners) {
      try {
        listener(notification);
      } catch {
        /* a single rogue listener mustn't break the rest */
      }
    }
  }
}
