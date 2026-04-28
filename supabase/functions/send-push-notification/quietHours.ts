/**
 * Quiet-hours window math. The recipient's window is two `time` values
 * (HH:MM:SS) interpreted as Europe/Berlin local. The window is the
 * half-open interval [start, end). When `start > end` the window wraps
 * over midnight (e.g. 22:00–07:00) and "within" becomes
 * `now >= start OR now < end`.
 *
 * `now` is taken as a UTC `Date`; we convert to Berlin local time via
 * `Intl.DateTimeFormat` so DST is handled correctly without us shipping
 * a tz database.
 */

export interface QuietHoursSettings {
  enabled: boolean;
  /** "HH:MM" or "HH:MM:SS" — Postgres `time` ISO format. Null when disabled. */
  startTime: string | null;
  /** "HH:MM" or "HH:MM:SS" — null when disabled. */
  endTime: string | null;
}

/**
 * Returns true when the current Berlin-local time falls inside the
 * recipient's quiet-hours window. False when:
 *   - the window is disabled,
 *   - either time is missing,
 *   - the times are equal (degenerate empty window),
 *   - or `now` lies outside the (possibly wrapping) window.
 */
export function isWithinQuietHours(now: Date, settings: QuietHoursSettings): boolean {
  if (!settings.enabled) return false;
  if (!settings.startTime || !settings.endTime) return false;

  const startMin = parseHHMM(settings.startTime);
  const endMin = parseHHMM(settings.endTime);
  if (startMin === null || endMin === null) return false;
  if (startMin === endMin) return false;

  const nowMin = berlinMinutesOfDay(now);

  if (startMin < endMin) {
    return nowMin >= startMin && nowMin < endMin;
  }
  // wrap-around (e.g. 22:00–07:00)
  return nowMin >= startMin || nowMin < endMin;
}

/** "HH:MM" / "HH:MM:SS" → minutes since midnight, or null on parse failure. */
export function parseHHMM(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

/** UTC `Date` → minutes since midnight in Europe/Berlin. */
export function berlinMinutesOfDay(now: Date): number {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = fmt.formatToParts(now);
  const hourStr = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minStr = parts.find((p) => p.type === 'minute')?.value ?? '00';
  // Some V8 builds return "24" for midnight under hour12:false. Normalize.
  let h = Number(hourStr);
  if (h === 24) h = 0;
  const m = Number(minStr);
  return h * 60 + m;
}
