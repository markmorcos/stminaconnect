/**
 * Date helpers anchored to the church's canonical timezone, Europe/Berlin.
 *
 * The rule (per design.md decision 5):
 *   - "Today" / "Yesterday" / "N days ago" are computed against the
 *     Berlin civil date so a 10pm event in California still reads as
 *     "yesterday" in Munich the next morning.
 *   - Absolute dates (the second argument of `formatRelativeOrDate`)
 *     render in the **device's** locale + timezone — that's what users
 *     expect when they read e.g. "Saved on 2026-04-28 18:32".
 *
 * DST correctness: Europe/Berlin observes DST. Both transitions need
 * special care:
 *   - Spring-forward (last Sunday of March, 02:00 → 03:00): the local
 *     day still has 24 calendar hours; whole-day diffs work normally.
 *   - Fall-back (last Sunday of October, 03:00 → 02:00): same.
 * The implementation derives Berlin civil date by formatting through
 * `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' })` rather
 * than by adding/subtracting offsets, so DST is the platform's problem
 * and we don't introduce off-by-one bugs at the boundary.
 */

const BERLIN = 'Europe/Berlin';

/** Returns the Berlin civil date (YYYY-MM-DD) for the given instant. */
export function berlinDate(at: Date | string | number): string {
  const date = at instanceof Date ? at : new Date(at);
  // `en-CA` formats as YYYY-MM-DD which we can compare lexicographically.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BERLIN,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Berlin-anchored whole-day difference between two instants.
 * A return of 0 means "same Berlin day"; 1 means "one Berlin day apart"
 * (typically yesterday relative to today).
 */
export function berlinDayDiff(from: Date | string | number, to: Date | string | number): number {
  const a = berlinDate(from);
  const b = berlinDate(to);
  // Build UTC midnights from the YYYY-MM-DD strings. Subtracting two
  // UTC midnights produces an integer number of 86_400_000-ms days,
  // even across a DST boundary, because UTC has no DST.
  const aUtc = Date.UTC(Number(a.slice(0, 4)), Number(a.slice(5, 7)) - 1, Number(a.slice(8, 10)));
  const bUtc = Date.UTC(Number(b.slice(0, 4)), Number(b.slice(5, 7)) - 1, Number(b.slice(8, 10)));
  return Math.round((bUtc - aUtc) / 86_400_000);
}

export interface FormatRelativeOptions {
  /** Override for unit tests. Defaults to `Date.now()`. */
  now?: Date | string | number;
  /** The locale used for the absolute fallback (device locale by default). */
  language?: string;
}

/**
 * Translates an instant into a relative bucket suitable for surfaces
 * like My Group ("Seen yesterday") or Recent newcomers ("3 days ago"):
 *
 *   - 'today'         — same Berlin civil date as `now`.
 *   - 'yesterday'     — exactly one Berlin civil day before `now`.
 *   - { daysAgo: N }  — N >= 2.
 *   - { absolute }    — > 30 days ago; render via the caller using
 *                       the device locale formatter.
 *
 * Future dates collapse to 'today' (the screen surfaces "today" rather
 * than "in 2 days" — relative-future labels aren't needed in v1).
 */
export type RelativeBucket =
  | { kind: 'today' }
  | { kind: 'yesterday' }
  | { kind: 'daysAgo'; days: number }
  | { kind: 'absolute' };

export function relativeBucket(
  at: Date | string | number,
  options: FormatRelativeOptions = {},
): RelativeBucket {
  const now = options.now ?? Date.now();
  const diff = berlinDayDiff(at, now);
  if (diff <= 0) return { kind: 'today' };
  if (diff === 1) return { kind: 'yesterday' };
  if (diff <= 30) return { kind: 'daysAgo', days: diff };
  return { kind: 'absolute' };
}
