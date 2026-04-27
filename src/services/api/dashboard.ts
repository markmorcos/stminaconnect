/**
 * Typed wrappers for the admin dashboard RPCs (027_dashboard_rpcs.sql).
 * Each function maps 1:1 to its SQL counterpart so the dashboard can
 * fetch sections in parallel from TanStack Query.
 *
 * Errors propagate to TanStack Query unmodified — the dashboard renders
 * a per-section error placeholder rather than failing the whole screen,
 * so we don't catch / re-throw here.
 */
import { supabase } from './supabase';
import type {
  DashboardAtRiskRow,
  DashboardAttendanceTrendPoint,
  DashboardNewcomerFunnel,
  DashboardOverview,
  DashboardRegionRow,
} from '@/types/dashboard';

export async function fetchDashboardOverview(): Promise<DashboardOverview> {
  const { data, error } = await supabase.rpc('dashboard_overview');
  if (error) throw error;
  return data as DashboardOverview;
}

export async function fetchDashboardAttendanceTrend(
  weeks = 12,
): Promise<DashboardAttendanceTrendPoint[]> {
  const { data, error } = await supabase.rpc('dashboard_attendance_trend', {
    p_weeks: weeks,
  });
  if (error) throw error;
  return (data ?? []) as DashboardAttendanceTrendPoint[];
}

export async function fetchDashboardAtRisk(): Promise<DashboardAtRiskRow[]> {
  const { data, error } = await supabase.rpc('dashboard_at_risk');
  if (error) throw error;
  return (data ?? []) as DashboardAtRiskRow[];
}

export async function fetchDashboardNewcomerFunnel(days = 90): Promise<DashboardNewcomerFunnel> {
  const { data, error } = await supabase.rpc('dashboard_newcomer_funnel', {
    p_days: days,
  });
  if (error) throw error;
  return data as DashboardNewcomerFunnel;
}

export async function fetchDashboardRegionBreakdown(top = 8): Promise<DashboardRegionRow[]> {
  const { data, error } = await supabase.rpc('dashboard_region_breakdown', {
    p_top: top,
  });
  if (error) throw error;
  return (data ?? []) as DashboardRegionRow[];
}
