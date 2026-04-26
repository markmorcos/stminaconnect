/**
 * Tests for the auto-sync behaviours added to address two real-device
 * issues:
 *   1. Online save needs manual refresh — fixed by `kick()` after each
 *      enqueue.
 *   2. Offline → online doesn't auto-sync — fixed by an internal retry
 *      timer that fires when the head op's `next_attempt_at` arrives.
 */
/* eslint-disable import/first -- jest.mock() is hoisted; imports follow */
jest.mock('@/services/db/database', () => ({
  getDatabase: jest.fn(),
  __setDatabaseForTests: jest.fn(),
}));

jest.mock('@/services/db/repositories/personsRepo', () => ({
  rewritePersonId: jest.fn(),
  upsertPersons: jest.fn(),
  softDeletePersons: jest.fn(),
  listPersons: jest.fn(),
  getPerson: jest.fn(),
}));

jest.mock('@/services/db/repositories/attendanceRepo', () => ({
  applyServerRows: jest.fn(),
  rewriteAttendancePersonId: jest.fn(),
  markPresent: jest.fn(),
  unmarkPresent: jest.fn(),
  getEventAttendance: jest.fn(),
}));

jest.mock('@/services/db/repositories/eventsRepo', () => ({
  upsertEvents: jest.fn(),
  getTodayEvents: jest.fn(),
  getEvent: jest.fn(),
}));

jest.mock('@/services/db/repositories/notificationsRepo', () => ({
  upsertNotifications: jest.fn(),
  insertLocalSystemNotification: jest.fn(),
  listNotifications: jest.fn(),
  markRead: jest.fn(),
}));

jest.mock('@/services/db/repositories/syncMetaRepo', () => ({
  getMeta: jest.fn().mockResolvedValue(null),
  setMeta: jest.fn(),
}));

jest.mock('@/state/authStore', () => ({
  useAuthStore: { getState: () => ({ servant: { id: 'servant-1' } }) },
}));

jest.mock('@/state/notificationsStore', () => ({
  useNotificationsStore: { getState: () => ({ add: jest.fn() }) },
}));

import { getDatabase } from '@/services/db/database';
import { enqueue } from '@/services/db/repositories/queueRepo';
import { createSyncEngine, type SupabaseLike } from '@/services/sync/SyncEngine';

import { FakeQueueDb } from './fakeDb';
/* eslint-enable import/first */

const mockedGetDb = getDatabase as jest.MockedFunction<typeof getDatabase>;

function makeClient(handlers: Record<string, (args: unknown) => unknown>): SupabaseLike {
  const rpc = jest.fn(async (name: string, args: unknown) => {
    const handler = handlers[name];
    if (!handler) return { data: null, error: null };
    try {
      const data = await Promise.resolve(handler(args));
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  });
  return { rpc: rpc as never };
}

describe('SyncEngine auto-sync', () => {
  let fake: FakeQueueDb;

  beforeEach(() => {
    fake = new FakeQueueDb();
    mockedGetDb.mockResolvedValue(fake as never);
  });

  describe('kick()', () => {
    it('debounces multiple kicks into a single runOnce', async () => {
      jest.useFakeTimers();
      try {
        let calls = 0;
        const client = makeClient({
          mark_attendance: () => {
            calls++;
            return 1;
          },
          sync_persons_since: () => [],
          sync_events_since: () => [],
          sync_attendance_since: () => [],
          sync_notifications_since: () => [],
        });
        const engine = createSyncEngine({ client });
        await enqueue({
          op_type: 'mark_attendance',
          payload: { event_id: 'e', person_ids: ['p1'] },
        });
        engine.kick();
        engine.kick();
        engine.kick();
        // Three kicks coalesce into one timer; advance past the debounce.
        await jest.advanceTimersByTimeAsync(60);
        // Drain microtasks for the awaited push/pull chain.
        await Promise.resolve();
        await Promise.resolve();
        await jest.advanceTimersByTimeAsync(0);
        expect(calls).toBe(1);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('retry timer', () => {
    it('schedules another runOnce when a transient failure leaves a pending op', async () => {
      jest.useFakeTimers();
      try {
        let attempts = 0;
        const client = makeClient({
          mark_attendance: () => {
            attempts++;
            if (attempts === 1) throw new Error('Network request failed');
            return 1;
          },
          sync_persons_since: () => [],
          sync_events_since: () => [],
          sync_attendance_since: () => [],
          sync_notifications_since: () => [],
        });
        const engine = createSyncEngine({ client });
        await enqueue({
          op_type: 'mark_attendance',
          payload: { event_id: 'e', person_ids: ['p1'] },
        });

        // First runOnce: push fails with a transient error; backoff
        // schedules `next_attempt_at = now + 5_000`.
        await engine.runOnce();
        expect(attempts).toBe(1);
        expect(fake.queue).toHaveLength(1);
        expect(fake.queue[0].status).toBe('pending');
        expect(fake.queue[0].attempts).toBe(1);

        // Advance past the 5s backoff so the retry timer fires.
        await jest.advanceTimersByTimeAsync(5_500);
        await Promise.resolve();
        await Promise.resolve();
        await jest.advanceTimersByTimeAsync(0);

        // Retry should have drained the op.
        expect(attempts).toBe(2);
        expect(fake.queue).toHaveLength(0);
      } finally {
        jest.useRealTimers();
      }
    });

    it('network reconnect resets pending backoffs and re-runs', async () => {
      jest.useFakeTimers();
      try {
        let attempts = 0;
        const client = makeClient({
          mark_attendance: () => {
            attempts++;
            if (attempts === 1) throw new Error('Network request failed');
            return 1;
          },
          sync_persons_since: () => [],
          sync_events_since: () => [],
          sync_attendance_since: () => [],
          sync_notifications_since: () => [],
        });
        const engine = createSyncEngine({ client });
        await enqueue({
          op_type: 'mark_attendance',
          payload: { event_id: 'e', person_ids: ['p1'] },
        });
        // First attempt fails: head op now has next_attempt_at = now+5_000.
        await engine.runOnce();
        expect(fake.queue[0].next_attempt_at).toBeGreaterThan(Date.now());

        // Wire start() with a network listener we control. Calling
        // `triggerConnected()` simulates an offline → online transition.
        let onConnected: (() => void) | null = null;
        const teardown = engine.start({
          onAppForeground: () => () => {},
          onSignedIn: () => () => {},
          onNetworkConnected: (cb) => {
            onConnected = cb;
            return () => {};
          },
        });
        // `start()` immediately calls fire(); flush microtasks.
        await jest.advanceTimersByTimeAsync(0);
        await Promise.resolve();
        await Promise.resolve();

        // Trigger reconnect.
        onConnected!();
        await jest.advanceTimersByTimeAsync(0);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await jest.advanceTimersByTimeAsync(0);

        expect(attempts).toBeGreaterThanOrEqual(2);
        expect(fake.queue).toHaveLength(0);
        teardown();
      } finally {
        jest.useRealTimers();
      }
    });

    it('skips RPC entirely while OS reports offline; drains within 2s of reconnect', async () => {
      jest.useFakeTimers();
      const Network = jest.requireMock('expo-network') as {
        getNetworkStateAsync: jest.Mock;
      };
      Network.getNetworkStateAsync.mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      });
      try {
        let attempts = 0;
        const client = makeClient({
          mark_attendance: () => {
            attempts++;
            return 1;
          },
          sync_persons_since: () => [],
          sync_events_since: () => [],
          sync_attendance_since: () => [],
          sync_notifications_since: () => [],
        });
        const engine = createSyncEngine({ client });
        await enqueue({
          op_type: 'mark_attendance',
          payload: { event_id: 'e', person_ids: ['p1'] },
        });

        // First runOnce: OS offline → push pre-check returns immediately
        // without touching the queue. attempts=0.
        await engine.runOnce();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        expect(attempts).toBe(0);
        expect(fake.queue).toHaveLength(1);
        expect(fake.queue[0].attempts).toBe(0);
        expect(fake.queue[0].next_attempt_at).toBe(0);

        // 2s probe fires while still offline: still no RPC.
        await jest.advanceTimersByTimeAsync(2_100);
        await Promise.resolve();
        await Promise.resolve();
        expect(attempts).toBe(0);

        // Flip OS to online; the next 2s probe should drain the queue.
        Network.getNetworkStateAsync.mockResolvedValue({
          isConnected: true,
          isInternetReachable: true,
        });
        await jest.advanceTimersByTimeAsync(2_100);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(attempts).toBe(1);
        expect(fake.queue).toHaveLength(0);
      } finally {
        Network.getNetworkStateAsync.mockResolvedValue({
          isConnected: true,
          isInternetReachable: true,
        });
        jest.useRealTimers();
      }
    });

    it('does not schedule a retry when the queue is empty', async () => {
      jest.useFakeTimers();
      try {
        const client = makeClient({
          sync_persons_since: () => [],
          sync_events_since: () => [],
          sync_attendance_since: () => [],
          sync_notifications_since: () => [],
        });
        const engine = createSyncEngine({ client });
        await engine.runOnce();
        // No pending timers should remain after a clean run.
        expect(jest.getTimerCount()).toBe(0);
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
