/**
 * Unit tests for the notifications Zustand store. Verifies the
 * unread/read transitions, banner auto-dismiss timing, and the de-dup
 * guard in `add`.
 */
import {
  __resetNotificationsStoreForTests,
  useNotificationsStore,
} from '@/state/notificationsStore';
import type { Notification } from '@/services/notifications/types';

const baseNotification: Notification = {
  id: 'n-1',
  type: 'system',
  payload: { message: 'hi' },
  recipientServantId: 's-1',
  createdAt: '2026-04-26T10:00:00Z',
  readAt: null,
};

beforeEach(() => {
  jest.useFakeTimers();
  __resetNotificationsStoreForTests();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('add', () => {
  it('inserts at the head, increments unreadCount, and surfaces a banner', () => {
    useNotificationsStore.getState().add(baseNotification);
    const s = useNotificationsStore.getState();
    expect(s.inbox).toHaveLength(1);
    expect(s.unreadCount).toBe(1);
    expect(s.bannerNotification?.id).toBe('n-1');
  });

  it('is idempotent for the same id', () => {
    useNotificationsStore.getState().add(baseNotification);
    useNotificationsStore.getState().add(baseNotification);
    expect(useNotificationsStore.getState().inbox).toHaveLength(1);
    expect(useNotificationsStore.getState().unreadCount).toBe(1);
  });

  it('does not surface a banner for already-read inserts', () => {
    useNotificationsStore.getState().add({
      ...baseNotification,
      readAt: '2026-04-26T11:00:00Z',
    });
    expect(useNotificationsStore.getState().bannerNotification).toBeNull();
    expect(useNotificationsStore.getState().unreadCount).toBe(0);
  });
});

describe('markRead', () => {
  it('flips the row to read, decrements the count, and clears the matching banner', () => {
    useNotificationsStore.getState().add(baseNotification);
    useNotificationsStore.getState().markRead('n-1');
    const s = useNotificationsStore.getState();
    expect(s.inbox[0].readAt).not.toBeNull();
    expect(s.unreadCount).toBe(0);
    expect(s.bannerNotification).toBeNull();
  });

  it('is a no-op for an unknown id', () => {
    useNotificationsStore.getState().add(baseNotification);
    useNotificationsStore.getState().markRead('unknown');
    expect(useNotificationsStore.getState().unreadCount).toBe(1);
  });
});

describe('markAllRead', () => {
  it('marks every row read and zeros the count', () => {
    useNotificationsStore.getState().add(baseNotification);
    useNotificationsStore.getState().add({ ...baseNotification, id: 'n-2' });
    useNotificationsStore.getState().markAllRead();
    const s = useNotificationsStore.getState();
    expect(s.inbox.every((n) => Boolean(n.readAt))).toBe(true);
    expect(s.unreadCount).toBe(0);
  });
});

describe('banner auto-dismiss', () => {
  it('clears the banner after 8 seconds', () => {
    useNotificationsStore.getState().add(baseNotification);
    expect(useNotificationsStore.getState().bannerNotification?.id).toBe('n-1');
    jest.advanceTimersByTime(8000);
    expect(useNotificationsStore.getState().bannerNotification).toBeNull();
  });
});

describe('reset', () => {
  it('clears inbox, count, and any pending banner', () => {
    useNotificationsStore.getState().add(baseNotification);
    useNotificationsStore.getState().reset();
    const s = useNotificationsStore.getState();
    expect(s.inbox).toEqual([]);
    expect(s.unreadCount).toBe(0);
    expect(s.bannerNotification).toBeNull();
  });
});
