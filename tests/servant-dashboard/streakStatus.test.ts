/**
 * streakStatus — covers all four buckets plus edge cases.
 *
 *   - on_break overrides any streak/threshold combination.
 *   - streak === 0 → green regardless of threshold.
 *   - 0 < streak < threshold → yellow.
 *   - streak >= threshold → red.
 */
import { streakStatus } from '@/features/servantDashboard/streakStatus';

describe('streakStatus', () => {
  it('returns "break" when status is on_break, regardless of streak/threshold', () => {
    expect(streakStatus(0, 3, 'on_break', '2026-05-15')).toBe('break');
    expect(streakStatus(7, 3, 'on_break', '2026-05-15')).toBe('break');
    expect(streakStatus(2, 3, 'on_break', null)).toBe('break');
  });

  it('returns "green" when streak is 0', () => {
    expect(streakStatus(0, 3, 'active', null)).toBe('green');
    expect(streakStatus(0, 3, 'new', null)).toBe('green');
  });

  it('returns "yellow" when 0 < streak < threshold', () => {
    expect(streakStatus(1, 3, 'active', null)).toBe('yellow');
    expect(streakStatus(2, 3, 'active', null)).toBe('yellow');
    expect(streakStatus(5, 6, 'active', null)).toBe('yellow');
  });

  it('returns "red" when streak >= threshold', () => {
    expect(streakStatus(3, 3, 'active', null)).toBe('red');
    expect(streakStatus(4, 3, 'active', null)).toBe('red');
    expect(streakStatus(99, 3, 'inactive', null)).toBe('red');
  });

  it('clamps non-integer / negative inputs sensibly', () => {
    expect(streakStatus(-2, 3, 'active', null)).toBe('green');
    expect(streakStatus(1.4, 3, 'active', null)).toBe('yellow');
    expect(streakStatus(2, 0, 'active', null)).toBe('red'); // threshold floored to 1
  });
});
