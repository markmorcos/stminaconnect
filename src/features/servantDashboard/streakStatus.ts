/**
 * Pure function mapping a person's streak + threshold + lifecycle status
 * to a colour bucket for the My Group section of the servant home.
 *
 *   - 'break'  — person.status is 'on_break' (chip overrides streak).
 *   - 'red'    — streak >= threshold (alert-level).
 *   - 'yellow' — 1 <= streak < threshold.
 *   - 'green'  — streak == 0 (attended last counted event).
 *
 * Threshold is the priority-specific override or the global default from
 * `alert_config`; both are returned by `servant_my_group`. The function
 * is intentionally side-effect free so the rule has a single, unit-tested
 * source of truth and the SQL never needs to mirror it.
 */

export type StreakStatus = 'green' | 'yellow' | 'red' | 'break';
export type PersonLifecycleStatus = 'new' | 'active' | 'inactive' | 'on_break';

export function streakStatus(
  streak: number,
  threshold: number,
  status: PersonLifecycleStatus,
  pausedUntil: string | Date | null,
): StreakStatus {
  if (status === 'on_break') {
    // Honour the `on_break` flag even if `paused_until` has fallen in
    // the past; the daily cron flips the status back to active, so a
    // stale row before that runs should still render as "on break".
    if (pausedUntil == null) return 'break';
    const expiresAt = pausedUntil instanceof Date ? pausedUntil : new Date(pausedUntil);
    if (Number.isNaN(expiresAt.getTime())) return 'break';
    return 'break';
  }

  const safeThreshold = Math.max(1, Math.floor(threshold));
  const safeStreak = Math.max(0, Math.floor(streak));

  if (safeStreak === 0) return 'green';
  if (safeStreak >= safeThreshold) return 'red';
  return 'yellow';
}
