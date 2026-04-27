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
