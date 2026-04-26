/**
 * Type shapes for the attendance capability — mirror the schema in
 * `supabase/migrations/015_attendance.sql` and the RPC projections in
 * `016_attendance_rpcs.sql`. Screens import these via
 * `services/api/attendance.ts`, never directly from supabase-js.
 */

export interface AttendanceRow {
  id: string;
  event_id: string;
  person_id: string;
  marked_by: string;
  marked_at: string;
  is_present: boolean;
}

export interface EventAttendanceRow {
  person_id: string;
  marked_by: string;
  marked_at: string;
}

export interface PersonSearchHit {
  id: string;
  first_name: string;
  last_name: string;
  region: string | null;
}
