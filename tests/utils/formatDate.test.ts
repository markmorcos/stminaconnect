/**
 * formatDate — Berlin-anchored relative-date helpers, including DST
 * boundary correctness.
 *
 * The two boundaries we exercise:
 *   - Spring-forward: last Sunday of March 2027 → 2027-03-28.
 *     At 02:00 Europe/Berlin clocks jump to 03:00 (CET → CEST).
 *   - Fall-back:     last Sunday of October 2026 → 2026-10-25.
 *     At 03:00 Europe/Berlin clocks fall to 02:00 (CEST → CET).
 *
 * The whole-day arithmetic must stay correct across both transitions
 * because the streak walk and the home My Group "Seen N days ago"
 * label both depend on it.
 */
import { berlinDate, berlinDayDiff, relativeBucket } from '@/utils/formatDate';

describe('formatDate — berlinDate', () => {
  it('returns the Berlin civil date for a UTC instant', () => {
    // 2026-04-28T22:00:00Z is 2026-04-29 00:00 Berlin (CEST = UTC+2).
    expect(berlinDate('2026-04-28T22:00:00Z')).toBe('2026-04-29');
  });

  it('handles a UTC instant that lands earlier in the Berlin day', () => {
    // 2026-04-28T01:00:00Z is still 2026-04-28 03:00 Berlin.
    expect(berlinDate('2026-04-28T01:00:00Z')).toBe('2026-04-28');
  });
});

describe('formatDate — berlinDayDiff', () => {
  it('returns 0 for two instants on the same Berlin day', () => {
    expect(berlinDayDiff('2026-04-28T08:00:00Z', '2026-04-28T20:00:00Z')).toBe(0);
  });

  it('returns 1 for the immediately preceding Berlin day', () => {
    expect(berlinDayDiff('2026-04-27T08:00:00Z', '2026-04-28T08:00:00Z')).toBe(1);
  });

  it('counts whole days correctly across the spring-forward DST boundary', () => {
    // 2027-03-27 → 2027-03-30. The DST transition is 2027-03-28 02:00
    // Berlin (skipping to 03:00). The local day still has its 24-hour
    // calendar slot, so the diff must be 3.
    const diff = berlinDayDiff('2027-03-27T10:00:00Z', '2027-03-30T10:00:00Z');
    expect(diff).toBe(3);
  });

  it('counts whole days correctly across the fall-back DST boundary', () => {
    // 2026-10-24 → 2026-10-26 (transition 2026-10-25 03:00 Berlin).
    const diff = berlinDayDiff('2026-10-24T10:00:00Z', '2026-10-26T10:00:00Z');
    expect(diff).toBe(2);
  });

  it('returns the right diff exactly across the DST jump itself', () => {
    // 2027-03-28T00:30Z (still 2027-03-28 02:30 CET, just before the
    // jump) → 2027-03-28T03:00Z (2027-03-28 05:00 CEST). Same Berlin
    // day; diff must be 0 even though wall-clock hours skipped one.
    expect(berlinDayDiff('2027-03-28T00:30:00Z', '2027-03-28T03:00:00Z')).toBe(0);
  });
});

describe('formatDate — relativeBucket', () => {
  const NOW = '2026-04-28T18:00:00Z'; // 2026-04-28 20:00 Berlin (CEST).

  it("returns 'today' when the instant is on the same Berlin day", () => {
    expect(relativeBucket('2026-04-28T08:00:00Z', { now: NOW })).toEqual({
      kind: 'today',
    });
  });

  it("returns 'yesterday' for an instant exactly one Berlin day before", () => {
    expect(relativeBucket('2026-04-27T08:00:00Z', { now: NOW })).toEqual({
      kind: 'yesterday',
    });
  });

  it("returns 'daysAgo' with the day count for 2..30 days back", () => {
    expect(relativeBucket('2026-04-25T08:00:00Z', { now: NOW })).toEqual({
      kind: 'daysAgo',
      days: 3,
    });
  });

  it("returns 'absolute' when the instant is more than 30 days back", () => {
    expect(relativeBucket('2026-03-15T08:00:00Z', { now: NOW })).toEqual({
      kind: 'absolute',
    });
  });

  it("collapses future instants to 'today' (no relative-future labels in v1)", () => {
    expect(relativeBucket('2026-04-29T08:00:00Z', { now: NOW })).toEqual({
      kind: 'today',
    });
  });
});
