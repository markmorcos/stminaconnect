/**
 * Mobile-side wrappers around the attendance RPCs declared in
 * `supabase/migrations/016_attendance_rpcs.sql`. Screens import from
 * here rather than calling `supabase.rpc(...)` directly — keeps the
 * RPC-only access pattern enforceable.
 *
 * The RPC parameters are `p_event_id` / `p_person_ids` (with the `p_`
 * prefix) rather than the bare column names. The prefix is a defensive
 * pattern — see the function-level comment in `016_attendance_rpcs.sql`
 * for why a same-name parameter trips PL/pgSQL's variable_conflict
 * guard inside `on conflict (event_id, person_id)`.
 */
import type { EventAttendanceRow, PersonSearchHit } from '@/types/attendance';

import { supabase } from './supabase';

/**
 * Upserts is_present=true rows for each (event, person) pair. Idempotent:
 * calling twice with the same payload returns the same final state and
 * the unique constraint coalesces duplicate inserts.
 *
 * Returns the number of rows upserted server-side.
 */
export async function markAttendance(
  eventId: string,
  personIds: readonly string[],
): Promise<number> {
  if (personIds.length === 0) return 0;
  const { data, error } = await supabase.rpc('mark_attendance', {
    p_event_id: eventId,
    p_person_ids: personIds,
  });
  if (error) throw error;
  return (data as number | null) ?? 0;
}

/**
 * Deletes attendance rows for the given (event, person) pairs.
 * Returns the number of rows deleted server-side.
 */
export async function unmarkAttendance(
  eventId: string,
  personIds: readonly string[],
): Promise<number> {
  if (personIds.length === 0) return 0;
  const { data, error } = await supabase.rpc('unmark_attendance', {
    p_event_id: eventId,
    p_person_ids: personIds,
  });
  if (error) throw error;
  return (data as number | null) ?? 0;
}

/**
 * Returns the set of person_ids marked present for the event, plus
 * audit fields. The roster screen uses this to render check states
 * on entry.
 */
export async function getEventAttendance(eventId: string): Promise<EventAttendanceRow[]> {
  const { data, error } = await supabase.rpc('get_event_attendance', { p_event_id: eventId });
  if (error) throw error;
  return (data ?? []) as EventAttendanceRow[];
}

/**
 * ILIKE-on-name search across non-deleted persons. Capped at 25 rows
 * server-side; empty / whitespace-only queries return no rows.
 */
export async function searchPersons(query: string): Promise<PersonSearchHit[]> {
  const { data, error } = await supabase.rpc('search_persons', { query });
  if (error) throw error;
  return (data ?? []) as PersonSearchHit[];
}

/**
 * Convenience: server-side check for whether an event's attendance
 * editing window is still open. Used by the roster screen to decide
 * between editable and read-only modes.
 */
export async function isEventWithinEditWindow(eventId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_event_within_edit_window', {
    p_event_id: eventId,
  });
  if (error) throw error;
  return data === true;
}
