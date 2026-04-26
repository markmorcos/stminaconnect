/**
 * Thin wrapper over the Google Calendar v3 events.list endpoint.
 *
 * `singleEvents=true` expands recurring events into individual instances
 * — see design.md decision 4. Each instance comes back with a unique
 * `id` like `<masterId>_20260928T100000Z`, which we persist verbatim
 * as `events.google_event_id`.
 */

const CAL_BASE = 'https://www.googleapis.com/calendar/v3/calendars';

export interface GoogleCalendarEvent {
  id: string;
  status?: string; // 'confirmed' | 'cancelled' | 'tentative'
  summary?: string;
  description?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
}

export interface ListEventsArgs {
  calendarId: string;
  accessToken: string;
  timeMin: Date;
  timeMax: Date;
}

/**
 * Fetch all events in [timeMin, timeMax) for `calendarId`, paginating
 * through `nextPageToken` until the response stops returning one.
 *
 * Filters out cancelled instances — those represent recurring-event
 * exceptions or deletions, neither of which should land in `events`.
 */
export async function listCalendarEvents(args: ListEventsArgs): Promise<GoogleCalendarEvent[]> {
  const { calendarId, accessToken, timeMin, timeMax } = args;
  const all: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${CAL_BASE}/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('timeMin', timeMin.toISOString());
    url.searchParams.set('timeMax', timeMax.toISOString());
    url.searchParams.set('maxResults', '250');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const resp = await fetch(url.toString(), {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`google calendar list failed: ${resp.status} ${text}`);
    }
    const json = (await resp.json()) as {
      items?: GoogleCalendarEvent[];
      nextPageToken?: string;
    };
    for (const item of json.items ?? []) {
      if (item.status === 'cancelled') continue;
      all.push(item);
    }
    pageToken = json.nextPageToken;
  } while (pageToken);

  return all;
}

/**
 * Pull a usable ISO timestamp out of a Google event endpoint, falling
 * back to all-day `date` (interpreted as midnight UTC). Returns null
 * for events with neither, which the caller should skip.
 */
export function endpointToIso(ep: { dateTime?: string; date?: string }): string | null {
  if (ep.dateTime) return new Date(ep.dateTime).toISOString();
  if (ep.date) return new Date(`${ep.date}T00:00:00Z`).toISOString();
  return null;
}
