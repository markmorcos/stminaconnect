/**
 * Unit tests for `local_sync_queue` repository (FIFO + temp_id rewrite).
 * Drives the real repository code against an in-memory pattern-matched
 * fake DB so we exercise the SQL generation paths.
 */
/* eslint-disable import/first -- jest.mock() is hoisted; imports follow */
jest.mock('@/services/db/database', () => ({
  getDatabase: jest.fn(),
  __setDatabaseForTests: jest.fn(),
  DATABASE_NAME: 'stmina.db',
}));

import { __setDatabaseForTests, getDatabase } from '@/services/db/database';
import {
  enqueue,
  peek,
  dequeue,
  length,
  listAll,
  markAttempt,
  markNeedsAttention,
  rewriteTempId,
  clearQueue,
} from '@/services/db/repositories/queueRepo';

import { FakeQueueDb } from './fakeDb';
/* eslint-enable import/first */

const mockedGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

describe('queueRepo (FIFO)', () => {
  let fake: FakeQueueDb;

  beforeEach(() => {
    fake = new FakeQueueDb();
    mockedGetDatabase.mockResolvedValue(fake as never);
  });

  afterEach(() => {
    __setDatabaseForTests(null);
  });

  it('enqueue → peek returns the oldest op first; dequeue removes it', async () => {
    const id1 = await enqueue({
      op_type: 'mark_attendance',
      payload: { event_id: 'e', person_ids: ['p1'] },
    });
    const id2 = await enqueue({
      op_type: 'mark_attendance',
      payload: { event_id: 'e', person_ids: ['p2'] },
    });
    const id3 = await enqueue({
      op_type: 'mark_attendance',
      payload: { event_id: 'e', person_ids: ['p3'] },
    });

    expect(await length()).toBe(3);

    const head = await peek();
    expect(head?.id).toBe(id1);
    await dequeue(head!.id);
    expect((await peek())?.id).toBe(id2);
    expect(await length()).toBe(2);

    void id3;
  });

  it('listAll returns ops in insertion order', async () => {
    await enqueue({ op_type: 'mark_attendance', payload: { a: 1 } });
    await enqueue({ op_type: 'unmark_attendance', payload: { a: 2 } });
    await enqueue({ op_type: 'create_person', payload: { a: 3 }, temp_id: 'temp-1' });
    const all = await listAll();
    expect(all.map((o) => o.op_type)).toEqual([
      'mark_attendance',
      'unmark_attendance',
      'create_person',
    ]);
  });

  it('markAttempt schedules the next retry per the backoff schedule', async () => {
    const id = await enqueue({ op_type: 'mark_attendance', payload: {} });
    const t0 = 1_000_000;
    await markAttempt(id, 'network', t0);
    const after1 = await peek(t0 + 4_999);
    expect(after1).toBeNull();
    const after1ok = await peek(t0 + 5_000);
    expect(after1ok?.id).toBe(id);
    expect(after1ok?.attempts).toBe(1);

    await markAttempt(id, 'network', t0);
    const after2 = await peek(t0 + 14_999);
    expect(after2).toBeNull();
    const after2ok = await peek(t0 + 15_000);
    expect(after2ok?.attempts).toBe(2);
  });

  it('markNeedsAttention removes the op from the pending queue', async () => {
    const id = await enqueue({ op_type: 'mark_attendance', payload: {} });
    await markNeedsAttention(id, 'edit_window_closed');
    expect(await peek()).toBeNull();
    expect(await length()).toBe(1);
  });

  it('clearQueue empties the queue', async () => {
    await enqueue({ op_type: 'mark_attendance', payload: {} });
    await enqueue({ op_type: 'mark_attendance', payload: {} });
    await clearQueue();
    expect(await length()).toBe(0);
  });

  it('rewriteTempId rewrites payload references and clears temp_id', async () => {
    const tempId = 'temp-abc';
    await enqueue({
      op_type: 'create_person',
      payload: { payload: { name: 'A' } },
      temp_id: tempId,
    });
    await enqueue({
      op_type: 'update_person',
      payload: { person_id: tempId, payload: { first_name: 'B' } },
    });
    await enqueue({
      op_type: 'mark_attendance',
      payload: { event_id: 'e', person_ids: [tempId, 'real-other'] },
    });

    await rewriteTempId(tempId, 'real-xyz');

    const all = await listAll();
    // Every reference to temp_id should now be 'real-xyz'.
    for (const op of all) {
      const json = JSON.stringify(op.payload);
      expect(json).not.toContain(tempId);
    }
    const update = all.find((o) => o.op_type === 'update_person');
    expect(update?.payload).toEqual({ person_id: 'real-xyz', payload: { first_name: 'B' } });
    const mark = all.find((o) => o.op_type === 'mark_attendance');
    expect(mark?.payload).toEqual({ event_id: 'e', person_ids: ['real-xyz', 'real-other'] });
    // temp_id column gets cleared after rewrite.
    expect(all.every((o) => o.temp_id === null)).toBe(true);
  });
});
