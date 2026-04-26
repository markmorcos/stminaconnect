/**
 * Unit tests for MockNotificationService — `dispatch` calls the right
 * RPC, `subscribe` opens a Realtime channel and forwards INSERT events
 * to listeners and the Zustand store, and `teardown` removes the
 * subscription.
 */
/* eslint-disable import/first -- jest.mock() is hoisted; imports follow */
jest.mock('@/services/api/supabase', () => {
  const onMock: jest.Mock = jest.fn(() => channelObj);
  const subscribeMock: jest.Mock = jest.fn(() => channelObj);
  const channelObj: { on: jest.Mock; subscribe: jest.Mock } = {
    on: onMock,
    subscribe: subscribeMock,
  };
  const channelMock = jest.fn(() => channelObj);
  const removeChannelMock = jest.fn().mockResolvedValue(undefined);
  const supabase = {
    rpc: jest.fn(),
    from: jest.fn(),
    channel: channelMock,
    removeChannel: removeChannelMock,
  };
  // Also expose handles on the module itself so tests can read them.
  return {
    supabase,
    __mocks__: { onMock, subscribeMock, channelMock, removeChannelMock },
  };
});

import { MockNotificationService } from '@/services/notifications/MockNotificationService';
import * as supabaseMod from '@/services/api/supabase';
import {
  __resetNotificationsStoreForTests,
  useNotificationsStore,
} from '@/state/notificationsStore';
import type { NotificationRow } from '@/services/notifications/types';
/* eslint-enable import/first */

const supabase = supabaseMod.supabase;
const mocks = (supabaseMod as unknown as { __mocks__: Record<string, jest.Mock> }).__mocks__;

const mockedRpc = supabase.rpc as unknown as jest.Mock;
const mockedFrom = supabase.from as unknown as jest.Mock;

const SERVANT_ID = '00000000-0000-0000-0000-000000000001';

function makeService(servantId: string | null = SERVANT_ID): MockNotificationService {
  return new MockNotificationService({ getServantId: () => servantId });
}

beforeEach(() => {
  jest.clearAllMocks();
  __resetNotificationsStoreForTests();
});

describe('dispatch', () => {
  it('calls dispatch_notification with the right args and returns the new id', async () => {
    mockedRpc.mockResolvedValue({ data: 'notif-1', error: null });
    const service = makeService();
    const id = await service.dispatch({
      recipientServantId: SERVANT_ID,
      type: 'system',
      payload: { message: 'hi' },
    });
    expect(mockedRpc).toHaveBeenCalledWith('dispatch_notification', {
      recipient: SERVANT_ID,
      type: 'system',
      payload: { message: 'hi' },
    });
    expect(id).toBe('notif-1');
  });

  it('throws on RPC error', async () => {
    mockedRpc.mockResolvedValue({ data: null, error: new Error('admin only') });
    const service = makeService();
    await expect(
      service.dispatch({
        recipientServantId: SERVANT_ID,
        type: 'system',
        payload: { message: 'hi' },
      }),
    ).rejects.toThrow('admin only');
  });
});

describe('subscribe + Realtime insert', () => {
  it('opens a Realtime channel filtered to the servant and forwards inserts to the store and listener', async () => {
    const service = makeService();
    const listener = jest.fn();
    service.subscribe(listener);
    // ensureChannel runs as a void promise — flush microtasks so it can
    // wire its `.on(...)` listener before we assert on the mock.
    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.channelMock).toHaveBeenCalledWith(`notifications:${SERVANT_ID}`);

    const onCall = mocks.onMock.mock.calls[0];
    expect(onCall[0]).toBe('postgres_changes');
    expect(onCall[1]).toMatchObject({
      event: 'INSERT',
      table: 'notifications',
      filter: `recipient_servant_id=eq.${SERVANT_ID}`,
    });
    const handler = onCall[2] as (payload: { new: NotificationRow }) => void;
    const row: NotificationRow = {
      id: 'n-1',
      recipient_servant_id: SERVANT_ID,
      type: 'system',
      payload: { message: 'hi' },
      read_at: null,
      created_at: '2026-04-26T10:00:00Z',
    };
    handler({ new: row });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toMatchObject({ id: 'n-1', type: 'system' });

    const state = useNotificationsStore.getState();
    expect(state.inbox).toHaveLength(1);
    expect(state.unreadCount).toBe(1);
    expect(state.bannerNotification?.id).toBe('n-1');
  });

  it('does not open a channel when there is no signed-in servant', async () => {
    const service = makeService(null);
    service.subscribe(jest.fn());
    await Promise.resolve();
    expect(mocks.channelMock).not.toHaveBeenCalled();
  });

  it('teardown removes the channel and clears the store', async () => {
    const service = makeService();
    service.subscribe(jest.fn());
    await Promise.resolve();
    await service.teardown();
    expect(mocks.removeChannelMock).toHaveBeenCalled();
    const state = useNotificationsStore.getState();
    expect(state.inbox).toHaveLength(0);
    expect(state.unreadCount).toBe(0);
  });
});

describe('markRead / markAllRead', () => {
  it('markRead calls the RPC and updates the store', async () => {
    const service = makeService();
    useNotificationsStore.getState().hydrate(
      [
        {
          id: 'n-1',
          type: 'system',
          payload: { message: 'hi' },
          recipientServantId: SERVANT_ID,
          createdAt: '2026-04-26T10:00:00Z',
          readAt: null,
        },
      ],
      1,
    );

    mockedRpc.mockResolvedValue({ data: true, error: null });
    await service.markRead('n-1');
    expect(mockedRpc).toHaveBeenCalledWith('mark_notification_read', {
      notification_id: 'n-1',
    });
    expect(useNotificationsStore.getState().unreadCount).toBe(0);
  });

  it('markAllRead calls the RPC and zeroes the unread count', async () => {
    const service = makeService();
    useNotificationsStore.getState().hydrate(
      [
        {
          id: 'a',
          type: 'system',
          payload: {},
          recipientServantId: SERVANT_ID,
          createdAt: '2026-04-26T10:00:00Z',
          readAt: null,
        },
        {
          id: 'b',
          type: 'system',
          payload: {},
          recipientServantId: SERVANT_ID,
          createdAt: '2026-04-26T11:00:00Z',
          readAt: null,
        },
      ],
      2,
    );
    mockedRpc.mockResolvedValue({ data: 2, error: null });
    await service.markAllRead();
    expect(mockedRpc).toHaveBeenCalledWith('mark_all_notifications_read');
    expect(useNotificationsStore.getState().unreadCount).toBe(0);
  });
});

describe('refresh', () => {
  it('hydrates the store from the table and unread count RPC', async () => {
    const rows: NotificationRow[] = [
      {
        id: 'n-1',
        recipient_servant_id: SERVANT_ID,
        type: 'system',
        payload: {},
        read_at: null,
        created_at: '2026-04-26T10:00:00Z',
      },
    ];
    const limitMock = jest.fn().mockResolvedValue({ data: rows, error: null });
    const orderMock = jest.fn(() => ({ limit: limitMock }));
    const eqMock = jest.fn(() => ({ order: orderMock }));
    const selectMock = jest.fn(() => ({ eq: eqMock }));
    mockedFrom.mockReturnValue({ select: selectMock });
    mockedRpc.mockResolvedValue({ data: 1, error: null });

    const service = makeService();
    await service.refresh();

    expect(mockedFrom).toHaveBeenCalledWith('notifications');
    expect(selectMock).toHaveBeenCalledWith('*');
    expect(eqMock).toHaveBeenCalledWith('recipient_servant_id', SERVANT_ID);
    expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(mockedRpc).toHaveBeenCalledWith('unread_notifications_count');
    expect(useNotificationsStore.getState().inbox).toHaveLength(1);
    expect(useNotificationsStore.getState().unreadCount).toBe(1);
  });

  it('clears the store when there is no signed-in servant', async () => {
    useNotificationsStore.getState().hydrate(
      [
        {
          id: 'n-1',
          type: 'system',
          payload: {},
          recipientServantId: SERVANT_ID,
          createdAt: '2026-04-26T10:00:00Z',
          readAt: null,
        },
      ],
      1,
    );
    const service = makeService(null);
    await service.refresh();
    expect(useNotificationsStore.getState().inbox).toHaveLength(0);
  });
});
