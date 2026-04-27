/**
 * Alert config API — wraps the SECURITY DEFINER RPCs from
 * `018_alert_config.sql` and `020_detect_absences.sql`.
 *
 * `getAlertConfig` is readable to any signed-in servant; the mutating
 * RPCs (`update_alert_config`, `recalculate_absences`) gate on
 * `is_admin()` server-side.
 */
import { supabase } from './supabase';

export type Priority = 'high' | 'medium' | 'low' | 'very_low';

export type PriorityThresholds = Partial<Record<Priority, number | null>>;

export interface AlertConfig {
  id: string;
  absence_threshold: number;
  priority_thresholds: PriorityThresholds;
  notify_admin_on_alert: boolean;
  escalation_threshold: number | null;
  /** Events newer than `now() - grace_period_days` are invisible to the streak walk. */
  grace_period_days: number;
  updated_at: string;
  updated_by: string | null;
}

export async function getAlertConfig(): Promise<AlertConfig> {
  const { data, error } = await supabase.rpc('get_alert_config');
  if (error) throw error;
  return data as AlertConfig;
}

export interface UpdateAlertConfigInput {
  absenceThreshold?: number;
  priorityThresholds?: PriorityThresholds;
  notifyAdminOnAlert?: boolean;
  escalationThreshold?: number | null;
  gracePeriodDays?: number;
}

export async function updateAlertConfig(input: UpdateAlertConfigInput): Promise<AlertConfig> {
  const clearEscalation =
    Object.prototype.hasOwnProperty.call(input, 'escalationThreshold') &&
    input.escalationThreshold === null;
  const { data, error } = await supabase.rpc('update_alert_config', {
    p_absence_threshold: input.absenceThreshold ?? null,
    p_priority_thresholds: input.priorityThresholds ?? null,
    p_notify_admin_on_alert: input.notifyAdminOnAlert ?? null,
    p_escalation_threshold: clearEscalation ? null : (input.escalationThreshold ?? null),
    p_clear_escalation: clearEscalation,
    p_grace_period_days: input.gracePeriodDays ?? null,
  });
  if (error) throw error;
  return data as AlertConfig;
}

export async function recalculateAbsences(): Promise<number> {
  const { data, error } = await supabase.rpc('recalculate_absences');
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}
