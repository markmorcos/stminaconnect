/**
 * Type contracts for the admin dashboard RPCs defined in
 * `supabase/migrations/027_dashboard_rpcs.sql`. Keep field names in
 * lock-step with the SQL — PostgREST returns columns by name.
 */

export interface DashboardOverview {
  totalMembers: number;
  activeLast30: number;
  newThisMonth: number;
  /** Number with one decimal place; 0 when no counted events occurred. */
  avgAttendance4w: number;
}

export interface DashboardAttendanceTrendPoint {
  event_id: string;
  event_title: string;
  /** ISO-8601 UTC timestamp. */
  start_at: string;
  attendee_count: number;
}

export interface DashboardAtRiskRow {
  servant_id: string;
  servant_name: string;
  person_id: string;
  person_name: string;
  streak: number;
  last_event_id: string | null;
  last_event_title: string | null;
  /** ISO-8601 UTC timestamp; null when the alert references a deleted event. */
  last_event_at: string | null;
}

export interface DashboardNewcomerFunnel {
  /** Top of funnel — all newcomers in the window. */
  quickAdd: number;
  /** Of those, currently registration_type='full'. */
  upgraded: number;
  /** Of those upgraded, attended a counted event in last 30 days. */
  active: number;
}

export interface DashboardRegionRow {
  region: string;
  member_count: number;
}

// ---------------------------------------------------------------------------
// Servant dashboard — types for `029_servant_dashboard_rpcs.sql`.
// ---------------------------------------------------------------------------

export type PersonStatus = 'new' | 'active' | 'inactive' | 'on_break';
export type PersonPriority = 'high' | 'medium' | 'low' | 'very_low';
export type RegistrationType = 'quick_add' | 'full';

export interface ServantMyGroupRow {
  person_id: string;
  first_name: string;
  last_name: string;
  region: string | null;
  /** ISO-8601 UTC; null when the person has never been marked present at a counted event. */
  last_attendance_at: string | null;
  streak: number;
  /** Priority-specific override or the global default from `alert_config`. */
  threshold: number;
  status: PersonStatus;
  /** YYYY-MM-DD; only meaningful when status === 'on_break'. */
  paused_until: string | null;
  priority: PersonPriority;
}

export interface ServantRecentNewcomerRow {
  person_id: string;
  first_name: string;
  last_name: string;
  /** ISO-8601 UTC. */
  registered_at: string;
  registration_type: RegistrationType;
  region: string | null;
}
