/**
 * Events API. `getTodayEvents` reads from the SQLite mirror populated
 * by the SyncEngine; the admin counted-event-pattern RPCs continue to
 * round-trip to Supabase because (a) admins are typically online and
 * (b) the pattern table doesn't participate in offline workflows.
 */
import {
  getCheckInEvents as repoGetCheckInEvents,
  getEvent as repoGetEvent,
  getTodayEvents as repoGetTodayEvents,
} from '@/services/db/repositories/eventsRepo';
import type {
  CalendarEvent,
  CountedEventPattern,
  SyncLogRow,
  TriggerSyncResult,
} from '@/types/event';

import { supabase } from './supabase';

export async function getTodayEvents(): Promise<CalendarEvent[]> {
  return repoGetTodayEvents();
}

export async function getCheckInEvents(pastDays: number): Promise<CalendarEvent[]> {
  return repoGetCheckInEvents(pastDays);
}

export async function getEvent(eventId: string): Promise<CalendarEvent | null> {
  return repoGetEvent(eventId);
}

export async function listCountedEventPatterns(): Promise<CountedEventPattern[]> {
  const { data, error } = await supabase.rpc('list_counted_event_patterns');
  if (error) throw error;
  return (data ?? []) as CountedEventPattern[];
}

export async function upsertCountedEventPattern(pattern: string): Promise<CountedEventPattern> {
  // The SQL parameter is `new_pattern` (not `pattern`) to avoid a
  // column-vs-argument name collision inside the INSERT … ON CONFLICT
  // clause. Mobile callers still pass a plain `pattern` string.
  const { data, error } = await supabase.rpc('upsert_counted_event_pattern', {
    new_pattern: pattern,
  });
  if (error) throw error;
  return data as CountedEventPattern;
}

export async function deleteCountedEventPattern(patternId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('delete_counted_event_pattern', {
    pattern_id: patternId,
  });
  if (error) throw error;
  return data === true;
}

export async function triggerCalendarSync(): Promise<TriggerSyncResult> {
  const { data, error } = await supabase.rpc('trigger_calendar_sync');
  if (error) throw error;
  return data as TriggerSyncResult;
}

/**
 * Returns the most recent sync_log row, or null when no sync has ever run.
 * Mirrors the NULL-composite-row caveat from `getPerson`: PostgREST
 * sometimes returns a record with all-null fields for a NULL composite
 * result, so we treat that as "no sync yet".
 */
export async function getLastSyncStatus(): Promise<SyncLogRow | null> {
  const { data, error } = await supabase.rpc('get_last_sync_status');
  if (error) throw error;
  const row = data as SyncLogRow | null;
  if (!row || row.id == null) return null;
  return row;
}

/**
 * Convenience: list events with `is_counted = true` whose start is in
 * the future (next 14 days). Used by the admin counted-events screen
 * preview list. Reads the `events` table directly because the rolling
 * window plus the RLS read policy already restrict the result safely.
 */
export async function listUpcomingCountedEvents(): Promise<CalendarEvent[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('is_counted', true)
    .gte('start_at', nowIso)
    .order('start_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CalendarEvent[];
}
