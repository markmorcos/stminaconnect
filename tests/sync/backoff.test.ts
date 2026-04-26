/**
 * Backoff schedule for the SyncEngine push retry loop. The schedule is
 * declared in `src/services/db/repositories/queueRepo.ts` and consumed
 * by `markAttempt` (writes `next_attempt_at = now + backoffFor(attempts)`).
 */
import { BACKOFF_SCHEDULE_MS, backoffFor } from '@/services/db/repositories/queueRepo';

describe('backoffFor', () => {
  it('returns the configured 5/15/60/300/600 second schedule', () => {
    expect(BACKOFF_SCHEDULE_MS).toEqual([5_000, 15_000, 60_000, 300_000, 600_000]);
    expect(backoffFor(0)).toBe(5_000);
    expect(backoffFor(1)).toBe(15_000);
    expect(backoffFor(2)).toBe(60_000);
    expect(backoffFor(3)).toBe(300_000);
    expect(backoffFor(4)).toBe(600_000);
  });

  it('caps at the last entry for large attempt counts', () => {
    expect(backoffFor(5)).toBe(600_000);
    expect(backoffFor(50)).toBe(600_000);
    expect(backoffFor(1_000)).toBe(600_000);
  });
});
