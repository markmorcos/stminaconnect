/**
 * Local-first attendance API. Roster reads come from the SQLite cache;
 * `markAttendance` / `unmarkAttendance` apply the change locally and
 * enqueue a corresponding op into `local_sync_queue`. The previous
 * synchronous "row count" return value is preserved as the count of
 * personIds that were applied locally so callers' "Saved (n)" copy
 * keeps working.
 *
 * `isEventWithinEditWindow` is now a pure local computation: take the
 * event's `start_at`, project it onto Berlin local time, add 1 day +
 * 03:00, compare to `now()`. The server still has final say at push
 * time — see `mark_attendance` in `016_attendance_rpcs.sql` and the
 * 4xx-surfaces-as-system-notification path in the SyncEngine.
 */
import {
  applyServerRows as applyAttendanceServerRows,
  getEventAttendance as repoGetEventAttendance,
  markPresent,
  unmarkPresent,
} from '@/services/db/repositories/attendanceRepo';
import { enqueue } from '@/services/db/repositories/queueRepo';
import { getSyncEngine } from '@/services/sync/SyncEngine';
import { useAuthStore } from '@/state/authStore';
import type { EventAttendanceRow, PersonSearchHit } from '@/types/attendance';

import { getDatabase } from '../db/database';
import { getEvent } from '../db/repositories/eventsRepo';

const BERLIN_TZ = 'Europe/Berlin';

function currentServantIdOrThrow(): string {
  const id = useAuthStore.getState().servant?.id;
  if (!id) throw new Error('not_authenticated');
  return id;
}

export async function markAttendance(
  eventId: string,
  personIds: readonly string[],
): Promise<number> {
  if (personIds.length === 0) return 0;
  const servantId = currentServantIdOrThrow();
  await markPresent(eventId, personIds, servantId);
  await enqueue({
    op_type: 'mark_attendance',
    payload: { event_id: eventId, person_ids: [...personIds] },
  });
  getSyncEngine().kick();
  return personIds.length;
}

export async function unmarkAttendance(
  eventId: string,
  personIds: readonly string[],
): Promise<number> {
  if (personIds.length === 0) return 0;
  await unmarkPresent(eventId, personIds);
  await enqueue({
    op_type: 'unmark_attendance',
    payload: { event_id: eventId, person_ids: [...personIds] },
  });
  getSyncEngine().kick();
  return personIds.length;
}

export async function getEventAttendance(eventId: string): Promise<EventAttendanceRow[]> {
  return repoGetEventAttendance(eventId);
}

/**
 * Local ILIKE-equivalent across non-deleted persons. Capped at 25 rows.
 * The `query` is trimmed; empty queries return no rows (matching the
 * server-side behaviour of `search_persons`).
 */
export async function searchPersons(query: string): Promise<PersonSearchHit[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];
  const db = await getDatabase();
  const like = `%${trimmed.toLowerCase()}%`;
  const rows = await db.getAllAsync<PersonSearchHit>(
    `SELECT id, first_name, last_name, region
       FROM persons
      WHERE deleted_at IS NULL
        AND (lower(first_name) LIKE ? OR lower(last_name) LIKE ?)
      ORDER BY last_name, first_name
      LIMIT 25`,
    [like, like],
  );
  return rows;
}

/**
 * Berlin-local edit-window check. Cutoff is 03:00 the day after the
 * event's start_at, plus `graceDays` to allow backfill within the
 * admin-configured grace window. Returns false when the event isn't
 * in the local cache so callers can short-circuit on "I don't know
 * about this event".
 *
 * `graceDays` MUST mirror `alert_config.grace_period_days` so the
 * local check agrees with `is_event_within_edit_window` on the server
 * (023_edit_window_grace.sql).
 */
export async function isEventWithinEditWindow(eventId: string, graceDays = 0): Promise<boolean> {
  const event = await getEvent(eventId);
  if (!event) return false;
  const cutoffMs = berlinCutoffMs(event.start_at, graceDays);
  return Date.now() < cutoffMs;
}

function berlinCutoffMs(eventStartIso: string, graceDays = 0): number {
  // Convert event start to a Berlin-local "year/month/day" tuple, then
  // build the cutoff by walking +1 day at 03:00 in Berlin and converting
  // back to UTC. Intl gives us a deterministic projection independent of
  // the device timezone.
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: BERLIN_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date(eventStartIso));
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const y = get('year');
  const m = get('month');
  const d = get('day');
  // 03:00 next day plus the grace window, expressed as a UTC instant by
  // computing the UTC offset Berlin had on that wall-clock date. CET is
  // UTC+1 and CEST is UTC+2, so we let the runtime resolve the offset
  // for that wall-clock moment via a probe Date.
  const grace = Math.max(0, Math.floor(graceDays));
  const cutoffUtcGuess = Date.UTC(y, m - 1, d, 3, 0, 0) + (1 + grace) * 24 * 3_600_000;
  // Refine offset using the actual wall clock at the guess.
  const offsetMs = berlinUtcOffsetMs(new Date(cutoffUtcGuess));
  return cutoffUtcGuess - offsetMs;
}

function berlinUtcOffsetMs(at: Date): number {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: BERLIN_TZ,
    timeZoneName: 'shortOffset',
  });
  const parts = fmt.formatToParts(at);
  const tz = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+0';
  const match = /GMT([+-]?)(\d{1,2})(?::?(\d{2}))?/.exec(tz);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = match[3] ? Number(match[3]) : 0;
  return sign * (hours * 60 + minutes) * 60 * 1000;
}

/** Re-exposed for the SyncEngine. */
export { applyAttendanceServerRows };
