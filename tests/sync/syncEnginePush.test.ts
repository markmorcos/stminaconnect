/**
 * Integration-style tests for `SyncEngine.push()`. The DB layer uses
 * the in-memory `FakeQueueDb`; the supabase client is a stub whose
 * `.rpc` returns `{ data, error }`.
 *
 * Verifies:
 *   * Ops drain in FIFO order.
 *   * 4xx errors surface a local system notification AND the op is
 *     marked needs_attention (no longer drained).
 *   * `create_person` rewrites temp_id in subsequent queued ops.
 */
/* eslint-disable import/first -- jest.mock() is hoisted; imports follow */
jest.mock('@/services/db/database', () => ({
  getDatabase: jest.fn(),
  __setDatabaseForTests: jest.fn(),
}));

jest.mock('@/services/db/repositories/personsRepo', () => ({
  rewritePersonId: jest.fn().mockResolvedValue(undefined),
  upsertPersons: jest.fn().mockResolvedValue(undefined),
  softDeletePersons: jest.fn().mockResolvedValue(undefined),
  listPersons: jest.fn(),
  getPerson: jest.fn(),
}));

jest.mock('@/services/db/repositories/attendanceRepo', () => ({
  applyServerRows: jest.fn().mockResolvedValue(undefined),
  rewriteAttendancePersonId: jest.fn().mockResolvedValue(undefined),
  markPresent: jest.fn(),
  unmarkPresent: jest.fn(),
  getEventAttendance: jest.fn(),
}));

jest.mock('@/services/db/repositories/eventsRepo', () => ({
  upsertEvents: jest.fn().mockResolvedValue(undefined),
  getTodayEvents: jest.fn(),
  getEvent: jest.fn(),
}));

jest.mock('@/services/db/repositories/notificationsRepo', () => ({
  upsertNotifications: jest.fn().mockResolvedValue(undefined),
  insertLocalSystemNotification: jest.fn().mockResolvedValue({ id: 'sys' }),
  listNotifications: jest.fn(),
  markRead: jest.fn(),
}));

jest.mock('@/services/db/repositories/syncMetaRepo', () => ({
  getMeta: jest.fn().mockResolvedValue(null),
  setMeta: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/state/authStore', () => ({
  useAuthStore: { getState: () => ({ servant: { id: 'servant-1' } }) },
}));

jest.mock('@/state/notificationsStore', () => ({
  useNotificationsStore: { getState: () => ({ add: jest.fn() }) },
}));

import { getDatabase } from '@/services/db/database';
import { rewritePersonId } from '@/services/db/repositories/personsRepo';
import { rewriteAttendancePersonId } from '@/services/db/repositories/attendanceRepo';
import { insertLocalSystemNotification } from '@/services/db/repositories/notificationsRepo';
import { enqueue } from '@/services/db/repositories/queueRepo';
import { createSyncEngine, type SupabaseLike } from '@/services/sync/SyncEngine';

import { FakeQueueDb } from './fakeDb';
/* eslint-enable import/first */

const mockedGetDb = getDatabase as jest.MockedFunction<typeof getDatabase>;

function makeClient(handlers: Record<string, (args: unknown) => unknown>): SupabaseLike {
  const rpc = jest.fn(async (name: string, args: unknown) => {
    const handler = handlers[name];
    if (!handler) return { data: null, error: { code: 'PGRST', message: `no handler ${name}` } };
    try {
      const data = await Promise.resolve(handler(args));
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  });
  return { rpc: rpc as never };
}

describe('SyncEngine.push', () => {
  let fake: FakeQueueDb;

  beforeEach(() => {
    fake = new FakeQueueDb();
    mockedGetDb.mockResolvedValue(fake as never);
    (rewritePersonId as jest.Mock).mockClear();
    (rewriteAttendancePersonId as jest.Mock).mockClear();
    (insertLocalSystemNotification as jest.Mock).mockClear();
  });

  it('drains ops in FIFO order and dequeues on success', async () => {
    await enqueue({
      op_type: 'mark_attendance',
      payload: { event_id: 'e', person_ids: ['p1'] },
    });
    await enqueue({
      op_type: 'mark_attendance',
      payload: { event_id: 'e', person_ids: ['p2'] },
    });

    const calls: string[] = [];
    const client = makeClient({
      mark_attendance: (args) => {
        const a = args as { p_person_ids: string[] };
        calls.push(a.p_person_ids[0]);
        return 1;
      },
    });

    const engine = createSyncEngine({ client });
    await engine.push();
    expect(calls).toEqual(['p1', 'p2']);
    expect(fake.queue).toHaveLength(0);
  });

  it('rewrites temp_id in subsequent ops when create_person succeeds', async () => {
    const tempId = 'temp-foo';
    await enqueue({
      op_type: 'create_person',
      payload: { payload: { first_name: 'A', last_name: 'B' } },
      temp_id: tempId,
    });
    await enqueue({
      op_type: 'update_person',
      payload: { person_id: tempId, payload: { first_name: 'A2' } },
    });

    const realId = 'real-bar';
    const calls: { name: string; args: unknown }[] = [];
    const client = makeClient({
      create_person: (args) => {
        calls.push({ name: 'create_person', args });
        return realId;
      },
      update_person: (args) => {
        calls.push({ name: 'update_person', args });
        return null;
      },
    });

    const engine = createSyncEngine({ client });
    await engine.push();

    expect(calls.map((c) => c.name)).toEqual(['create_person', 'update_person']);
    expect(calls[1].args).toMatchObject({ person_id: realId });
    expect(rewritePersonId).toHaveBeenCalledWith(tempId, realId);
    expect(rewriteAttendancePersonId).toHaveBeenCalledWith(tempId, realId);
    expect(fake.queue).toHaveLength(0);
  });

  it('marks 4xx ops as needs_attention and emits a local system notification', async () => {
    await enqueue({
      op_type: 'mark_attendance',
      payload: { event_id: 'e', person_ids: ['p1'] },
    });

    const client = makeClient({
      mark_attendance: () => {
        const err: { code: string; message: string } = {
          code: 'P0001',
          message: 'edit_window_closed',
        };
        throw err;
      },
    });

    const engine = createSyncEngine({ client });
    await engine.push();
    // Op stays in queue with status 'needs_attention'.
    expect(fake.queue).toHaveLength(1);
    expect(fake.queue[0].status).toBe('needs_attention');
    expect(insertLocalSystemNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientServantId: 'servant-1',
        message: expect.stringContaining('edit_window_closed'),
      }),
    );
  });

  it('keeps a transient (network) error in the queue with backoff', async () => {
    await enqueue({
      op_type: 'mark_attendance',
      payload: { event_id: 'e', person_ids: ['p1'] },
    });

    const client = makeClient({
      mark_attendance: () => {
        throw new Error('Network request failed');
      },
    });

    const engine = createSyncEngine({ client });
    await engine.push();
    expect(fake.queue).toHaveLength(1);
    expect(fake.queue[0].status).toBe('pending');
    expect(fake.queue[0].attempts).toBe(1);
    expect(fake.queue[0].next_attempt_at).toBeGreaterThan(0);
    expect(insertLocalSystemNotification).not.toHaveBeenCalled();
  });
});
