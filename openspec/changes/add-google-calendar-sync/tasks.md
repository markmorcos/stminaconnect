# Tasks — add-google-calendar-sync

## 1. Setup documentation

- [ ] 1.1 Add `docs/google-calendar-setup.md`: step-by-step (GCP project, enable Calendar API, create service account, download key, share calendar) with screenshots optional.
- [ ] 1.2 Update `.env.example` with `GOOGLE_CALENDAR_ID` (placeholder) and Edge Function secret `GOOGLE_SERVICE_ACCOUNT_KEY` documented in a comment.

## 2. Schema migrations

- [ ] 2.1 `008_events.sql`: events table per design + index on `start_at` and on `(is_counted, start_at)`.
- [ ] 2.2 `008_events.sql`: enable RLS — all signed-in servants can SELECT (events are not private). Deny INSERT/UPDATE/DELETE from clients.
- [ ] 2.3 `009_counted_event_patterns.sql`: counted_event_patterns table; RLS — admins read+write; servants read-only.
- [ ] 2.4 `010_match_counted_event.sql`: SQL function `match_counted_event(title text) returns boolean` doing case-insensitive substring match against `counted_event_patterns`.
- [ ] 2.5 `011_sync_log.sql`: sync_log table + retention policy (keep last 100 rows); admin read.

## 3. Edge Function

- [ ] 3.1 Scaffold `supabase/functions/sync-calendar-events/index.ts`.
- [ ] 3.2 Implement Google JWT signing using the service account key (Deno does not include a Google SDK; use raw JWT signing with Web Crypto).
- [ ] 3.3 Fetch `https://www.googleapis.com/calendar/v3/calendars/{cal}/events` with `singleEvents=true`, `timeMin`, `timeMax`, ordered by start time.
- [ ] 3.4 For each event, upsert into `events` with `is_counted = match_counted_event(title)`.
- [ ] 3.5 Write a sync_log row with outcome on entry and exit.
- [ ] 3.6 Deploy locally via `supabase functions serve sync-calendar-events` and validate.

## 4. Scheduling

- [ ] 4.1 `012_pg_cron_sync_calendar.sql`: `select cron.schedule('sync-calendar', '*/30 * * * *', $$ select net.http_post(...edge function url...); $$);`. Include the Edge Function URL via Vault or env-substitution at deploy time.
- [ ] 4.2 Document how to enable `pg_cron` and `pg_net` extensions in Supabase project settings (already on by default in CLI).

## 5. RPCs

- [ ] 5.1 `013_calendar_rpcs.sql`:
  - `get_today_events()` returns rows where `start_at` is within today (Europe/Berlin).
  - `list_counted_event_patterns()` admin-only.
  - `upsert_counted_event_pattern(pattern text)` admin-only; on save, runs `UPDATE events SET is_counted = match_counted_event(title)` over the entire rolling window.
  - `delete_counted_event_pattern(id uuid)` admin-only; same recompute behaviour.
  - `trigger_calendar_sync()` admin-only; rate-limited (1/min); calls Edge Function via pg_net.

## 6. Mobile API

- [ ] 6.1 `src/services/api/events.ts` exposing `getTodayEvents`, `listCountedEventPatterns`, `upsertCountedEventPattern`, `deleteCountedEventPattern`, `triggerCalendarSync`, `getLastSyncStatus`.
- [ ] 6.2 Type definitions in `src/types/event.ts`.

## 7. Admin screen

- [ ] 7.1 `app/(app)/admin/_layout.tsx`: stack with role gate — redirects non-admins to home.
- [ ] 7.2 `app/(app)/admin/counted-events.tsx`:
  - Top: last sync time + outcome chip + "Resync now" button (calls `triggerCalendarSync`).
  - Middle: list of patterns with delete buttons + "Add pattern" input.
  - Bottom: preview "Upcoming counted events (next 14 days)" reading `events` filtered by `is_counted=true` and future start.

## 8. Translations

- [ ] 8.1 Extend locales under `admin.countedEvents.*`: title, lastSync, resync, patterns.add, patterns.placeholder, patterns.empty, preview.title, preview.empty.

## 9. Tests

- [ ] 9.1 Unit (Deno test): JWT signing returns a valid 3-segment token.
- [ ] 9.2 Unit: `match_counted_event` returns true for substring matches; false otherwise; case-insensitive.
- [ ] 9.3 Integration: upserting a counted-event pattern recomputes `is_counted` for all events in window.
- [ ] 9.4 Integration: `get_today_events` returns events that span today in Europe/Berlin even if UTC start is yesterday.
- [ ] 9.5 Integration: `trigger_calendar_sync` rate-limit blocks second call within a minute.

## 10. Verification (in Expo Go)

- [ ] 10.1 Configure service account; populate calendar with three events: "Sunday Liturgy 2026-04-26", "Bible Study 2026-04-29", "Choir Practice 2026-04-28".
- [ ] 10.2 Manual sync via Edge Function: `events` table contains the three rows with correct timestamps.
- [ ] 10.3 As admin, open Counted Events screen → add pattern "Liturgy" → save → preview lists Sunday Liturgy as counted.
- [ ] 10.4 Add a second pattern "Bible" → preview now also lists Bible Study.
- [ ] 10.5 Remove "Bible" pattern → recompute → Bible Study no longer counted.
- [ ] 10.6 As servant, attempt to navigate to /admin/counted-events → redirected.
- [ ] 10.7 `openspec validate add-google-calendar-sync` passes.
