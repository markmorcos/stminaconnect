/**
 * Unit tests for the `services/api/attendance.ts` wrappers. Mocks
 * `supabase.rpc` so we can verify each wrapper sends the right RPC name
 * + payload and surfaces the row counts / errors from the underlying
 * call.
 */
/* eslint-disable import/first -- jest.mock is hoisted; imports follow */
jest.mock('@/services/api/supabase', () => ({
  supabase: { rpc: jest.fn() },
}));

import {
  getEventAttendance,
  isEventWithinEditWindow,
  markAttendance,
  searchPersons,
  unmarkAttendance,
} from '@/services/api/attendance';
import { supabase } from '@/services/api/supabase';
/* eslint-enable import/first */

const mockedRpc = supabase.rpc as unknown as jest.Mock;

beforeEach(() => {
  mockedRpc.mockReset();
});

describe('markAttendance', () => {
  it('calls mark_attendance with p_event_id + p_person_ids and returns the count', async () => {
    mockedRpc.mockResolvedValue({ data: 2, error: null });
    const out = await markAttendance('e1', ['p1', 'p2']);
    expect(mockedRpc).toHaveBeenCalledWith('mark_attendance', {
      p_event_id: 'e1',
      p_person_ids: ['p1', 'p2'],
    });
    expect(out).toBe(2);
  });

  it('short-circuits to zero when person_ids is empty (no RPC call)', async () => {
    const out = await markAttendance('e1', []);
    expect(mockedRpc).not.toHaveBeenCalled();
    expect(out).toBe(0);
  });

  it('throws on error', async () => {
    mockedRpc.mockResolvedValue({ data: null, error: { message: 'edit_window_closed' } });
    await expect(markAttendance('e1', ['p1'])).rejects.toMatchObject({
      message: 'edit_window_closed',
    });
  });
});

describe('unmarkAttendance', () => {
  it('calls unmark_attendance with the right args', async () => {
    mockedRpc.mockResolvedValue({ data: 1, error: null });
    await unmarkAttendance('e1', ['p1']);
    expect(mockedRpc).toHaveBeenCalledWith('unmark_attendance', {
      p_event_id: 'e1',
      p_person_ids: ['p1'],
    });
  });

  it('short-circuits when person_ids is empty', async () => {
    await unmarkAttendance('e1', []);
    expect(mockedRpc).not.toHaveBeenCalled();
  });
});

describe('getEventAttendance', () => {
  it('calls get_event_attendance and returns the rows', async () => {
    const rows = [{ person_id: 'p1', marked_by: 's1', marked_at: 't' }];
    mockedRpc.mockResolvedValue({ data: rows, error: null });
    const out = await getEventAttendance('e1');
    expect(mockedRpc).toHaveBeenCalledWith('get_event_attendance', { p_event_id: 'e1' });
    expect(out).toEqual(rows);
  });

  it('returns empty array when data is null', async () => {
    mockedRpc.mockResolvedValue({ data: null, error: null });
    expect(await getEventAttendance('e1')).toEqual([]);
  });
});

describe('searchPersons', () => {
  it('calls search_persons with the query and returns the rows', async () => {
    const rows = [{ id: 'p1', first_name: 'A', last_name: 'B', region: null }];
    mockedRpc.mockResolvedValue({ data: rows, error: null });
    const out = await searchPersons('Mar');
    expect(mockedRpc).toHaveBeenCalledWith('search_persons', { query: 'Mar' });
    expect(out).toEqual(rows);
  });
});

describe('isEventWithinEditWindow', () => {
  it('passes the eventId through and unwraps to a boolean', async () => {
    mockedRpc.mockResolvedValue({ data: true, error: null });
    expect(await isEventWithinEditWindow('e1')).toBe(true);
    expect(mockedRpc).toHaveBeenCalledWith('is_event_within_edit_window', { p_event_id: 'e1' });
  });

  it('returns false for a non-true payload', async () => {
    mockedRpc.mockResolvedValue({ data: false, error: null });
    expect(await isEventWithinEditWindow('e1')).toBe(false);
    mockedRpc.mockResolvedValue({ data: null, error: null });
    expect(await isEventWithinEditWindow('e1')).toBe(false);
  });
});
