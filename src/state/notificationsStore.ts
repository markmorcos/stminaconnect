/**
 * Zustand store of the in-app notification surface:
 *
 *   - `inbox` — every notification the current servant has received,
 *     newest first. Powers the inbox screen.
 *   - `unreadCount` — derived count for the home-screen badge. Mutates
 *     in lock-step with `inbox` reads/writes.
 *   - `bannerNotification` — the top notification we want to surface at
 *     the top of the screen. Cleared after 8s by `setBanner` itself, or
 *     manually via `dismissBanner`.
 */
import { create } from 'zustand';

import type { Notification } from '@/services/notifications/types';

const BANNER_AUTO_DISMISS_MS = 8000;

export interface NotificationsState {
  inbox: Notification[];
  unreadCount: number;
  bannerNotification: Notification | null;

  hydrate: (rows: Notification[], unreadCount: number) => void;
  add: (notification: Notification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  setBanner: (notification: Notification | null) => void;
  dismissBanner: () => void;
  reset: () => void;
}

let bannerTimer: ReturnType<typeof setTimeout> | null = null;

function clearBannerTimer(): void {
  if (bannerTimer !== null) {
    clearTimeout(bannerTimer);
    bannerTimer = null;
  }
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  inbox: [],
  unreadCount: 0,
  bannerNotification: null,

  hydrate(rows, unreadCount) {
    set({ inbox: rows, unreadCount });
  },

  add(notification) {
    const existing = get().inbox;
    if (existing.some((n) => n.id === notification.id)) return;
    const inbox = [notification, ...existing];
    const unreadCount = notification.readAt ? get().unreadCount : get().unreadCount + 1;
    set({ inbox, unreadCount });
    // New unread → surface as a banner. Read inserts (rare — sync
    // catches up on refresh) don't.
    if (!notification.readAt) {
      get().setBanner(notification);
    }
  },

  markRead(id) {
    const inbox = get().inbox;
    let flipped = false;
    const next = inbox.map((n) => {
      if (n.id === id && !n.readAt) {
        flipped = true;
        return { ...n, readAt: new Date().toISOString() } as Notification;
      }
      return n;
    });
    if (!flipped) return;
    set({
      inbox: next,
      unreadCount: Math.max(0, get().unreadCount - 1),
    });
    if (get().bannerNotification?.id === id) {
      get().dismissBanner();
    }
  },

  markAllRead() {
    const now = new Date().toISOString();
    const inbox = get().inbox.map((n) => (n.readAt ? n : ({ ...n, readAt: now } as Notification)));
    set({ inbox, unreadCount: 0 });
    if (get().bannerNotification) {
      get().dismissBanner();
    }
  },

  setBanner(notification) {
    clearBannerTimer();
    set({ bannerNotification: notification });
    if (notification) {
      bannerTimer = setTimeout(() => {
        clearBannerTimer();
        useNotificationsStore.setState((s) =>
          s.bannerNotification?.id === notification.id ? { bannerNotification: null } : s,
        );
      }, BANNER_AUTO_DISMISS_MS);
    }
  },

  dismissBanner() {
    clearBannerTimer();
    set({ bannerNotification: null });
  },

  reset() {
    clearBannerTimer();
    set({ inbox: [], unreadCount: 0, bannerNotification: null });
  },
}));

/** Test-only helper: cancels any pending auto-dismiss timer. */
export function __resetNotificationsStoreForTests(): void {
  clearBannerTimer();
  useNotificationsStore.setState({
    inbox: [],
    unreadCount: 0,
    bannerNotification: null,
  });
}
