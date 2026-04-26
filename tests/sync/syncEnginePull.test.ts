/**
 * Integration test for `SyncEngine.pull()`. The supabase RPCs are
 * stubbed; the per-table repos record what the engine applies. The
 * test verifies the pull→apply→watermark sequence: incoming rows are
 * upserted, then `last_pull_at` is bumped on the meta repo.
 */
/* eslint-disable import/first -- jest.mock() is hoisted; imports follow */
jest.mock('@/services/db/repositories/personsRepo', () => ({
  upsertPersons: jest.fn().mockResolvedValue(undefined),
  rewritePersonId: jest.fn(),
  softDeletePersons: jest.fn(),
  listPersons: jest.fn(),
  getPerson: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/services/db/repositories/eventsRepo', () => ({
  upsertEvents: jest.fn().mockResolvedValue(undefined),
  getTodayEvents: jest.fn(),
  getEvent: jest.fn(),
}));

jest.mock('@/services/db/repositories/attendanceRepo', () => ({
  applyServerRows: jest.fn().mockResolvedValue(undefined),
  rewriteAttendancePersonId: jest.fn(),
  markPresent: jest.fn(),
  unmarkPresent: jest.fn(),
  getEventAttendance: jest.fn(),
}));

jest.mock('@/services/db/repositories/notificationsRepo', () => ({
  upsertNotifications: jest.fn().mockResolvedValue(undefined),
  insertLocalSystemNotification: jest.fn(),
  listNotifications: jest.fn(),
  markRead: jest.fn(),
}));

jest.mock('@/services/db/repositories/queueRepo', () => ({
  listAll: jest.fn().mockResolvedValue([]),
  length: jest.fn().mockResolvedValue(0),
  peek: jest.fn().mockResolvedValue(null),
  dequeue: jest.fn(),
  markAttempt: jest.fn(),
  markNeedsAttention: jest.fn(),
  rewriteTempId: jest.fn(),
  clearQueue: jest.fn(),
  enqueue: jest.fn(),
  backoffFor: jest.fn(),
  BACKOFF_SCHEDULE_MS: [5_000, 15_000, 60_000, 300_000, 600_000],
}));

jest.mock('@/services/db/repositories/syncMetaRepo', () => ({
  getMeta: jest.fn(),
  setMeta: jest.fn().mockResolvedValue(undefined),
}));

import { applyServerRows } from '@/services/db/repositories/attendanceRepo';
import { upsertEvents } from '@/services/db/repositories/eventsRepo';
import { upsertNotifications } from '@/services/db/repositories/notificationsRepo';
import { upsertPersons } from '@/services/db/repositories/personsRepo';
import { getMeta, setMeta } from '@/services/db/repositories/syncMetaRepo';
import { createSyncEngine, type SupabaseLike } from '@/services/sync/SyncEngine';
/* eslint-enable import/first */

const PERSON = {
  id: 'p1',
  first_name: 'A',
  last_name: 'B',
  phone: null,
  region: null,
  language: 'en',
  priority: 'medium',
  assigned_servant: 's1',
  comments: null,
  status: 'new',
  paused_until: null,
  registration_type: 'quick_add',
  registered_by: 's1',
  registered_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
};

const EVENT = {
  id: 'e1',
  google_event_id: 'g1',
  title: 'Liturgy',
  description: null,
  start_at: '2026-04-26T07:00:00Z',
  end_at: '2026-04-26T09:00:00Z',
  is_counted: true,
  synced_at: '2026-04-26T05:00:00Z',
};

function makeClient(
  responses: Record<string, { data: unknown; error: unknown | null }>,
): SupabaseLike {
  const rpc = jest.fn(async (name: string) => {
    return responses[name] ?? { data: null, error: null };
  });
  return { rpc: rpc as never };
}

describe('SyncEngine.pull', () => {
  beforeEach(() => {
    (getMeta as jest.Mock).mockResolvedValue(null);
    (setMeta as jest.Mock).mockClear();
    (upsertPersons as jest.Mock).mockClear();
    (upsertEvents as jest.Mock).mockClear();
    (applyServerRows as jest.Mock).mockClear();
    (upsertNotifications as jest.Mock).mockClear();
  });

  it('passes since=null on first launch, then applies all rows and bumps the watermark', async () => {
    const client = makeClient({
      sync_persons_since: { data: [PERSON], error: null },
      sync_events_since: { data: [EVENT], error: null },
      sync_attendance_since: {
        data: [
          {
            kind: 'upsert',
            event_id: 'e1',
            person_id: 'p1',
            marked_by: 's1',
            marked_at: '2026-04-26T07:30:00Z',
            deleted_at: null,
          },
          {
            kind: 'delete',
            event_id: 'e1',
            person_id: 'p2',
            marked_by: null,
            marked_at: null,
            deleted_at: '2026-04-26T08:00:00Z',
          },
        ],
        error: null,
      },
      sync_notifications_since: { data: [], error: null },
    });

    const engine = createSyncEngine({ client });
    await engine.pull();

    expect(client.rpc).toHaveBeenCalledWith('sync_persons_since', { since: null });
    expect(upsertPersons).toHaveBeenCalledWith([PERSON], 'synced');
    expect(upsertEvents).toHaveBeenCalledWith([EVENT]);
    expect((applyServerRows as jest.Mock).mock.calls[0][0]).toEqual([
      {
        kind: 'upsert',
        event_id: 'e1',
        person_id: 'p1',
        marked_by: 's1',
        marked_at: '2026-04-26T07:30:00Z',
      },
      { kind: 'delete', event_id: 'e1', person_id: 'p2' },
    ]);
    expect(setMeta).toHaveBeenCalledWith('last_pull_at', expect.any(String));
  });

  it('passes the stored watermark to since on subsequent runs', async () => {
    (getMeta as jest.Mock).mockResolvedValue('2026-04-26T05:00:00Z');
    const client = makeClient({
      sync_persons_since: { data: [], error: null },
      sync_events_since: { data: [], error: null },
      sync_attendance_since: { data: [], error: null },
      sync_notifications_since: { data: [], error: null },
    });
    const engine = createSyncEngine({ client });
    await engine.pull();
    expect(client.rpc).toHaveBeenCalledWith('sync_persons_since', {
      since: '2026-04-26T05:00:00Z',
    });
  });

  it('throws and does not bump the watermark on RPC error', async () => {
    const client = makeClient({
      sync_persons_since: { data: null, error: { message: 'boom' } },
      sync_events_since: { data: [], error: null },
      sync_attendance_since: { data: [], error: null },
      sync_notifications_since: { data: [], error: null },
    });
    const engine = createSyncEngine({ client });
    await expect(engine.pull()).rejects.toBeTruthy();
    expect(setMeta).not.toHaveBeenCalled();
  });
});
