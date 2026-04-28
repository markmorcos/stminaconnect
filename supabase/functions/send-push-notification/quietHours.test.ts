import { assertEquals } from 'https://deno.land/std@0.220.0/assert/mod.ts';

import { berlinMinutesOfDay, isWithinQuietHours, parseHHMM } from './quietHours.ts';

Deno.test('parseHHMM accepts HH:MM and HH:MM:SS', () => {
  assertEquals(parseHHMM('00:00'), 0);
  assertEquals(parseHHMM('07:30'), 7 * 60 + 30);
  assertEquals(parseHHMM('23:59:59'), 23 * 60 + 59);
});

Deno.test('parseHHMM rejects garbage', () => {
  assertEquals(parseHHMM(''), null);
  assertEquals(parseHHMM('25:00'), null);
  assertEquals(parseHHMM('07:60'), null);
  assertEquals(parseHHMM('not a time'), null);
});

Deno.test('disabled window is never within', () => {
  // Even with both times set and "now" smack in the middle, disabled wins.
  const now = berlinMidnightOnDate('2026-01-15', 23, 30);
  assertEquals(
    isWithinQuietHours(now, {
      enabled: false,
      startTime: '22:00:00',
      endTime: '07:00:00',
    }),
    false,
  );
});

Deno.test('non-wrapping window: inside', () => {
  const now = berlinMidnightOnDate('2026-01-15', 14, 30);
  assertEquals(
    isWithinQuietHours(now, {
      enabled: true,
      startTime: '12:00:00',
      endTime: '15:00:00',
    }),
    true,
  );
});

Deno.test('non-wrapping window: outside', () => {
  const now = berlinMidnightOnDate('2026-01-15', 9, 30);
  assertEquals(
    isWithinQuietHours(now, {
      enabled: true,
      startTime: '12:00:00',
      endTime: '15:00:00',
    }),
    false,
  );
});

Deno.test('non-wrapping window: end is exclusive', () => {
  // 15:00 exactly is OUTSIDE [12:00, 15:00).
  const now = berlinMidnightOnDate('2026-01-15', 15, 0);
  assertEquals(
    isWithinQuietHours(now, {
      enabled: true,
      startTime: '12:00:00',
      endTime: '15:00:00',
    }),
    false,
  );
});

Deno.test('wrapping window: late evening counts as within', () => {
  const now = berlinMidnightOnDate('2026-01-15', 23, 30);
  assertEquals(
    isWithinQuietHours(now, {
      enabled: true,
      startTime: '22:00:00',
      endTime: '07:00:00',
    }),
    true,
  );
});

Deno.test('wrapping window: early morning counts as within', () => {
  const now = berlinMidnightOnDate('2026-01-15', 2, 0);
  assertEquals(
    isWithinQuietHours(now, {
      enabled: true,
      startTime: '22:00:00',
      endTime: '07:00:00',
    }),
    true,
  );
});

Deno.test('wrapping window: midday is outside', () => {
  const now = berlinMidnightOnDate('2026-01-15', 12, 0);
  assertEquals(
    isWithinQuietHours(now, {
      enabled: true,
      startTime: '22:00:00',
      endTime: '07:00:00',
    }),
    false,
  );
});

Deno.test('degenerate equal-times window is empty', () => {
  const now = berlinMidnightOnDate('2026-01-15', 22, 0);
  assertEquals(
    isWithinQuietHours(now, {
      enabled: true,
      startTime: '22:00:00',
      endTime: '22:00:00',
    }),
    false,
  );
});

Deno.test('berlinMinutesOfDay handles DST forward jump', () => {
  // 2026-03-29 02:30 UTC = 04:30 CEST (Berlin springs forward at 01:00 UTC).
  const utc = new Date('2026-03-29T02:30:00Z');
  assertEquals(berlinMinutesOfDay(utc), 4 * 60 + 30);
});

/**
 * Helper: build a `Date` (UTC) that, when interpreted in Europe/Berlin,
 * lands at the given (hour, minute). We compute the offset for a
 * reference UTC date and subtract.
 */
function berlinMidnightOnDate(yyyymmdd: string, h: number, m: number): Date {
  // Pick noon UTC on the date so we're never near a DST boundary.
  const utcRef = new Date(`${yyyymmdd}T12:00:00Z`);
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = fmt.formatToParts(utcRef);
  const berlinH = Number(parts.find((p) => p.type === 'hour')?.value ?? '12');
  const offsetHours = berlinH - 12; // delta from UTC noon to Berlin local hour
  // Build a UTC Date for the desired Berlin (h:m) by subtracting the offset.
  return new Date(`${yyyymmdd}T${pad(h - offsetHours)}:${pad(m)}:00Z`);
}

function pad(n: number): string {
  const wrapped = ((n % 24) + 24) % 24;
  return wrapped.toString().padStart(2, '0');
}
