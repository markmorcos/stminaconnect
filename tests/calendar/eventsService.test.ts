/**
 * Unit tests for the `services/api/events.ts` wrappers. Mocks
 * `supabase.rpc` and `supabase.from` so we can verify each wrapper
 * sends the right RPC name / payload, and that `getLastSyncStatus`
 * collapses PostgREST's all-null composite-row response to `null`.
 */
/* eslint-disable import/first */
jest.mock('@/services/api/supabase', () => {
  const builder: Record<string, jest.Mock> = {};
  builder.select = jest.fn(() => builder);
  builder.eq = jest.fn(() => builder);
  builder.gte = jest.fn(() => builder);
  builder.order = jest.fn(() => Promise.resolve({ data: [], error: null }));
  return {
    supabase: {
      rpc: jest.fn(),
      from: jest.fn(() => builder),
    },
    __builder: builder,
  };
});

import {
  deleteCountedEventPattern,
  getLastSyncStatus,
  getTodayEvents,
  listCountedEventPatterns,
  listUpcomingCountedEvents,
  triggerCalendarSync,
  upsertCountedEventPattern,
} from '@/services/api/events';
import { supabase } from '@/services/api/supabase';
/* eslint-enable import/first */

const mockedRpc = supabase.rpc as unknown as jest.Mock;
const mockedFrom = supabase.from as unknown as jest.Mock;

beforeEach(() => {
  mockedRpc.mockReset();
  mockedFrom.mockClear();
});

describe('getTodayEvents', () => {
  it('calls get_today_events and returns the rows', async () => {
    mockedRpc.mockResolvedValue({ data: [{ id: 'e1' }], error: null });
    const out = await getTodayEvents();
    expect(mockedRpc).toHaveBeenCalledWith('get_today_events');
    expect(out).toEqual([{ id: 'e1' }]);
  });

  it('throws on error', async () => {
    mockedRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(getTodayEvents()).rejects.toEqual({ message: 'boom' });
  });
});

describe('listCountedEventPatterns', () => {
  it('calls list_counted_event_patterns', async () => {
    mockedRpc.mockResolvedValue({ data: [], error: null });
    await listCountedEventPatterns();
    expect(mockedRpc).toHaveBeenCalledWith('list_counted_event_patterns');
  });
});

describe('upsertCountedEventPattern', () => {
  it('passes the pattern through under the new_pattern argument name', async () => {
    mockedRpc.mockResolvedValue({ data: { id: 'p1', pattern: 'Liturgy' }, error: null });
    const out = await upsertCountedEventPattern('Liturgy');
    expect(mockedRpc).toHaveBeenCalledWith('upsert_counted_event_pattern', {
      new_pattern: 'Liturgy',
    });
    expect(out).toEqual({ id: 'p1', pattern: 'Liturgy' });
  });
});

describe('deleteCountedEventPattern', () => {
  it('passes the id as pattern_id', async () => {
    mockedRpc.mockResolvedValue({ data: true, error: null });
    const ok = await deleteCountedEventPattern('p1');
    expect(mockedRpc).toHaveBeenCalledWith('delete_counted_event_pattern', { pattern_id: 'p1' });
    expect(ok).toBe(true);
  });

  it('returns false when RPC returned false', async () => {
    mockedRpc.mockResolvedValue({ data: false, error: null });
    const ok = await deleteCountedEventPattern('p1');
    expect(ok).toBe(false);
  });
});

describe('triggerCalendarSync', () => {
  it('returns the request_id payload', async () => {
    mockedRpc.mockResolvedValue({ data: { request_id: 42, outcome: 'queued' }, error: null });
    const out = await triggerCalendarSync();
    expect(mockedRpc).toHaveBeenCalledWith('trigger_calendar_sync');
    expect(out).toEqual({ request_id: 42, outcome: 'queued' });
  });

  it('surfaces server-side rate-limit errors', async () => {
    mockedRpc.mockResolvedValue({ data: null, error: { message: 'rate_limited: …' } });
    await expect(triggerCalendarSync()).rejects.toMatchObject({ message: /rate_limited/ });
  });
});

describe('getLastSyncStatus', () => {
  it('returns the row when present', async () => {
    const row = { id: 's1', source: 'calendar', outcome: 'success' };
    mockedRpc.mockResolvedValue({ data: row, error: null });
    const out = await getLastSyncStatus();
    expect(out).toEqual(row);
  });

  it('returns null when RPC returns null', async () => {
    mockedRpc.mockResolvedValue({ data: null, error: null });
    expect(await getLastSyncStatus()).toBeNull();
  });

  it('returns null for the all-null composite-row case', async () => {
    mockedRpc.mockResolvedValue({
      data: { id: null, source: null, outcome: null },
      error: null,
    });
    expect(await getLastSyncStatus()).toBeNull();
  });
});

describe('listUpcomingCountedEvents', () => {
  it('queries events filtered by is_counted=true and future start, ordered ascending', async () => {
    await listUpcomingCountedEvents();
    expect(mockedFrom).toHaveBeenCalledWith('events');
    // Builder returns the same object from each chain step, so we
    // assert the chain reached `.order(...)` with ascending=true.
    const builder = (mockedFrom as jest.Mock).mock.results[0].value as {
      eq: jest.Mock;
      gte: jest.Mock;
      order: jest.Mock;
    };
    expect(builder.eq).toHaveBeenCalledWith('is_counted', true);
    expect(builder.gte.mock.calls[0][0]).toBe('start_at');
    expect(builder.order).toHaveBeenCalledWith('start_at', { ascending: true });
  });
});
