## Context

The church already publishes events to Google Calendar; clergy update it directly. We don't want to require clergy to use a new tool. Reading the calendar from Supabase is straightforward via a Google service account; the constraints are window size, recurrence handling, sync frequency, and pattern matching for counting.

## Goals

- Single source of truth for events: Google Calendar.
- Eventually-consistent mirror in Postgres for fast app queries and offline pre-fetch.
- Admin-configurable counted-event patterns, validated against all events visible in the rolling window so the admin sees which events would be counted before saving.
- Idempotent, scheduled sync.
- No OAuth flow — service account only.

## Non-Goals

- Two-way sync. App never writes to Google Calendar.
- Per-event override (an admin marking a single non-matching event as counted). Patterns are the only mechanism in v1.
- Multi-calendar support. One calendar id per environment.
- Recurrence-rule expansion in app code. We rely on Google Calendar API's `singleEvents=true` parameter.

## Decisions

1. **Service account auth**:
   - Admin creates a Google Cloud project, enables Calendar API, creates a service account, downloads the JSON key.
   - Admin shares the church calendar with the service account email (Reader access).
   - Key JSON is stored as a Supabase Edge Function secret (`GOOGLE_SERVICE_ACCOUNT_KEY`).
   - Calendar ID stored as `GOOGLE_CALENDAR_ID`.
2. **Sync window**: 30 days past + 14 days future (resolves Open Question G1). Past 30 days lets us recompute attendance and streaks if a counted-event pattern is changed retroactively. Future 14 days lets the app preview upcoming events.
3. **Sync frequency**: every 30 minutes via `pg_cron`. Calendar changes are infrequent; servers don't need real-time. Manual "Resync now" button on the admin counted-events screen calls the Edge Function on demand.
4. **Recurrence**: pass `singleEvents=true&orderBy=startTime` to the Calendar API. Each instance comes back as a unique `id` like `<masterId>_20250928T100000Z` — we store that as `google_event_id`. No expansion logic in our code.
5. **`events` schema**:
   ```
   id              uuid pk default gen_random_uuid()
   google_event_id text unique not null
   title           text not null
   description     text
   start_at        timestamptz not null
   end_at          timestamptz not null
   is_counted      boolean not null default false
   synced_at       timestamptz not null default now()
   ```
6. **Counted-event pattern matching** (resolves Open Question G2): substring (case-insensitive) on `title`. Multiple patterns are OR'd. Implemented as `match_counted_event(title text) RETURNS boolean` reading from `counted_event_patterns`. Trigger or sync-job calls this; recomputed on every sync.
7. **`counted_event_patterns` schema**:
   ```
   id          uuid pk default gen_random_uuid()
   pattern     text not null unique
   created_by  uuid references servants(id)
   created_at  timestamptz default now()
   ```
8. **Pattern-change retroactive recompute**: when an admin adds/removes a pattern, the `upsert_counted_event_pattern` RPC also runs `UPDATE events SET is_counted = match_counted_event(title)` to rebuild over the rolling window.
9. **`get_today_events` definition**: returns events with `start_at >= today_in_berlin AND start_at < tomorrow_in_berlin`. Berlin timezone is constant `'Europe/Berlin'`.
10. **Sync error handling**: Edge Function logs errors to a `sync_log` table (light-weight: `id`, `started_at`, `finished_at`, `outcome`, `error`). Surfaced on the admin screen as last-sync timestamp + status.
11. **Admin screen UX**: top section shows last sync time + manual "Resync" button. Below that, a list of counted-event patterns with add/remove. Below that, a preview list: "Events in next 14 days that would count: …".

## Risks / Trade-offs

- **Risk**: service account key in Edge Function secrets is sensitive. Mitigation: documented rotation procedure; never logged.
- **Risk**: Google Calendar API rate limits. Mitigation: 30-min cadence is well within free quotas; manual resync button rate-limited to once per minute via a server-side check.
- **Risk**: timezone bugs around the day boundary in `get_today_events`. Mitigation: explicit tests at 23:59 and 00:01 Berlin time.
- **Trade-off**: rolling-window approach means changes to events older than 30 days are invisible. Acceptable — past events are immutable in practice.
- **Trade-off**: admin screen lives under `app/(app)/admin/` even though phase 13 is the proper "admin dashboard" change. Justified: this admin screen is logically part of _this_ capability, and folding it under admin-dashboard later (if needed) is a path move, not a rewrite.

## Migration Plan

- Three migrations + the `pg_cron` schedule statement.
- Edge Function deployed via `supabase functions deploy sync-calendar-events`.
- Initial backfill: admin manually triggers the function once after setup.

## Open Questions

- **G1, G2** resolved.
