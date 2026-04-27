/**
 * Unit tests for the local-first `services/api/attendance.ts` wrappers.
 * `markAttendance` / `unmarkAttendance` apply the change to the local
 * cache and enqueue an op; `getEventAttendance` / `searchPersons` read
 * locally; `isEventWithinEditWindow` is a pure Berlin-cutoff calc.
 */
/* eslint-disable import/first */
jest.mock('@/services/db/repositories/attendanceRepo', () => ({
  applyServerRows: jest.fn(),
  getEventAttendance: jest.fn(),
  markPresent: jest.fn().mockResolvedValue(undefined),
  unmarkPresent: jest.fn().mockResolvedValue(undefined),
  rewriteAttendancePersonId: jest.fn(),
}));

jest.mock('@/services/db/repositories/queueRepo', () => ({
  enqueue: jest.fn().mockResolvedValue(1),
}));

jest.mock('@/services/sync/SyncEngine', () => ({
  getSyncEngine: () => ({ kick: jest.fn(), runOnce: jest.fn() }),
}));

jest.mock('@/services/db/repositories/eventsRepo', () => ({
  getEvent: jest.fn(),
}));

jest.mock('@/services/db/database', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    getAllAsync: jest.fn().mockResolvedValue([]),
  }),
}));

jest.mock('@/state/authStore', () => ({
  useAuthStore: { getState: () => ({ servant: { id: 'servant-1' } }) },
}));

import {
  getEventAttendance,
  isEventWithinEditWindow,
  markAttendance,
  searchPersons,
  unmarkAttendance,
} from '@/services/api/attendance';
import { getDatabase } from '@/services/db/database';
import * as attendanceRepo from '@/services/db/repositories/attendanceRepo';
import { getEvent } from '@/services/db/repositories/eventsRepo';
import { enqueue } from '@/services/db/repositories/queueRepo';
/* eslint-enable import/first */

beforeEach(() => {
  (attendanceRepo.markPresent as jest.Mock).mockClear();
  (attendanceRepo.unmarkPresent as jest.Mock).mockClear();
  (attendanceRepo.getEventAttendance as jest.Mock).mockReset();
  (enqueue as jest.Mock).mockClear();
});

describe('markAttendance (local + enqueue)', () => {
  it('updates the local cache and enqueues mark_attendance', async () => {
    await markAttendance('e1', ['p1', 'p2']);
    expect(attendanceRepo.markPresent).toHaveBeenCalledWith('e1', ['p1', 'p2'], 'servant-1');
    expect(enqueue).toHaveBeenCalledWith({
      op_type: 'mark_attendance',
      payload: { event_id: 'e1', person_ids: ['p1', 'p2'] },
    });
  });

  it('short-circuits when person_ids is empty (no enqueue)', async () => {
    const out = await markAttendance('e1', []);
    expect(out).toBe(0);
    expect(enqueue).not.toHaveBeenCalled();
  });
});

describe('unmarkAttendance (local + enqueue)', () => {
  it('removes locally and enqueues unmark_attendance', async () => {
    await unmarkAttendance('e1', ['p1']);
    expect(attendanceRepo.unmarkPresent).toHaveBeenCalledWith('e1', ['p1']);
    expect(enqueue).toHaveBeenCalledWith({
      op_type: 'unmark_attendance',
      payload: { event_id: 'e1', person_ids: ['p1'] },
    });
  });
});

describe('getEventAttendance (local-first)', () => {
  it('returns rows from the local repository', async () => {
    const rows = [{ person_id: 'p1', marked_by: 's1', marked_at: 't' }];
    (attendanceRepo.getEventAttendance as jest.Mock).mockResolvedValue(rows);
    expect(await getEventAttendance('e1')).toEqual(rows);
  });
});

describe('searchPersons (local LIKE)', () => {
  it('returns no rows for an empty query without hitting the DB', async () => {
    expect(await searchPersons('   ')).toEqual([]);
  });

  it('passes a wildcarded LIKE to the DB on non-empty queries', async () => {
    const fakeDb = {
      getAllAsync: jest
        .fn()
        .mockResolvedValue([{ id: 'p1', first_name: 'A', last_name: 'Mar', region: null }]),
    };
    (getDatabase as jest.Mock).mockResolvedValue(fakeDb);
    const out = await searchPersons('Mar');
    expect(out).toHaveLength(1);
    expect(fakeDb.getAllAsync).toHaveBeenCalled();
  });
});

describe('isEventWithinEditWindow (Berlin cutoff)', () => {
  it('returns false when the event is missing locally', async () => {
    (getEvent as jest.Mock).mockResolvedValue(null);
    expect(await isEventWithinEditWindow('e-missing')).toBe(false);
  });

  it('returns true within 24h+3h of start_at', async () => {
    const eventStart = new Date('2026-04-26T07:00:00Z');
    (getEvent as jest.Mock).mockResolvedValue({
      id: 'e1',
      start_at: eventStart.toISOString(),
      end_at: new Date(eventStart.getTime() + 2 * 3600 * 1000).toISOString(),
    });
    const realNow = Date.now;
    Date.now = () => eventStart.getTime() + 3600_000; // 1h after start
    try {
      expect(await isEventWithinEditWindow('e1')).toBe(true);
    } finally {
      Date.now = realNow;
    }
  });

  it('returns false past the cutoff (>27h after start)', async () => {
    const eventStart = new Date('2026-04-26T07:00:00Z');
    (getEvent as jest.Mock).mockResolvedValue({
      id: 'e1',
      start_at: eventStart.toISOString(),
      end_at: new Date(eventStart.getTime() + 2 * 3600 * 1000).toISOString(),
    });
    const realNow = Date.now;
    Date.now = () => eventStart.getTime() + 30 * 3600_000; // 30h after start
    try {
      expect(await isEventWithinEditWindow('e1')).toBe(false);
    } finally {
      Date.now = realNow;
    }
  });

  it('extends the cutoff by graceDays so past-but-grace events are editable', async () => {
    const eventStart = new Date('2026-04-26T07:00:00Z');
    (getEvent as jest.Mock).mockResolvedValue({
      id: 'e1',
      start_at: eventStart.toISOString(),
      end_at: new Date(eventStart.getTime() + 2 * 3600 * 1000).toISOString(),
    });
    const realNow = Date.now;
    // 3 days after start: outside the no-grace cutoff (~27h) but inside
    // a 5-day grace window. graceDays=5 → cutoff is +6 days at 03:00 Berlin.
    Date.now = () => eventStart.getTime() + 3 * 24 * 3600_000;
    try {
      expect(await isEventWithinEditWindow('e1', 5)).toBe(true);
      expect(await isEventWithinEditWindow('e1', 0)).toBe(false);
    } finally {
      Date.now = realNow;
    }
  });
});
