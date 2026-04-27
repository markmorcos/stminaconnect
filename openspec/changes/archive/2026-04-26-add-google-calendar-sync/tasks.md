# Tasks — add-google-calendar-sync

## 1. Setup documentation

- [x] 1.1 Add `docs/google-calendar-setup.md`: step-by-step (GCP project, enable Calendar API, create service account, download key, share calendar) with screenshots optional.
- [x] 1.2 Update `.env.example` with `GOOGLE_CALENDAR_ID` (placeholder) and Edge Function secret `GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON` documented in a comment. (Renamed from `GOOGLE_SERVICE_ACCOUNT_KEY` in tasks.md to match the var already declared by `init-project-scaffolding`.)

## 2. Schema migrations

- [x] 2.1 `009_events.sql`: events table per design + index on `start_at` and on `(is_counted, start_at)`.
- [x] 2.2 `009_events.sql`: enable RLS — all signed-in servants can SELECT (events are not private). Deny INSERT/UPDATE/DELETE from clients.
- [x] 2.3 `010_counted_event_patterns.sql`: counted_event_patterns table; RLS — admins read+write (writes go through admin RPCs in 014); servants read-only.
- [x] 2.4 `011_match_counted_event.sql`: SQL function `match_counted_event(title text) returns boolean` doing case-insensitive substring match against `counted_event_patterns`.
- [x] 2.5 `012_sync_log.sql`: sync_log table + retention trigger (keep last 100 rows); admin read.

## 3. Edge Function

- [x] 3.1 Scaffold `supabase/functions/sync-calendar-events/index.ts`.
- [x] 3.2 Implement Google JWT signing using the service account key (Deno does not include a Google SDK; use raw JWT signing with Web Crypto). → `jwt.ts`.
- [x] 3.3 Fetch `https://www.googleapis.com/calendar/v3/calendars/{cal}/events` with `singleEvents=true`, `timeMin`, `timeMax`, ordered by start time. → `calendar.ts`.
- [x] 3.4 For each event, upsert into `events` with `is_counted = match_counted_event(title)`. Also delete rows that fell out of the window or were removed upstream.
- [x] 3.5 Write a sync_log row with outcome on entry and exit.
- [x] 3.6 Deploy locally via `supabase functions serve sync-calendar-events` and validate.

## 4. Scheduling

- [x] 4.1 `013_pg_cron_sync_calendar.sql`: defines `schedule_calendar_sync(function_url, auth_token)` and calls it from a Vault-driven DO block (best-effort; logs a NOTICE if Vault entries are missing). 30-minute cadence.
- [x] 4.2 Document how to enable `pg_cron` and `pg_net` extensions in Supabase project settings (already on by default in CLI). → `docs/google-calendar-setup.md` §8 + migration header.

## 5. RPCs

- [x] 5.1 `014_calendar_rpcs.sql`:
  - `get_today_events()` returns rows where `start_at` is within today (Europe/Berlin).
  - `list_counted_event_patterns()` available to all signed-in servants (read-only).
  - `upsert_counted_event_pattern(pattern text)` admin-only; on save, runs `UPDATE events SET is_counted = match_counted_event(title)` over the entire rolling window.
  - `delete_counted_event_pattern(pattern_id uuid)` admin-only; same recompute behaviour.
  - `trigger_calendar_sync()` admin-only; rate-limited (1/min via `sync_log.started_at`); calls Edge Function via pg_net using Vault-stored URL + key.
  - `get_last_sync_status()` admin-only — fuels the admin screen header.

## 6. Mobile API

- [x] 6.1 `src/services/api/events.ts` exposing `getTodayEvents`, `listCountedEventPatterns`, `upsertCountedEventPattern`, `deleteCountedEventPattern`, `triggerCalendarSync`, `getLastSyncStatus`, plus convenience `listUpcomingCountedEvents` for the admin-screen preview.
- [x] 6.2 Type definitions in `src/types/event.ts`.

## 7. Admin screen

- [x] 7.1 `app/(app)/admin/_layout.tsx`: stack with role gate — redirects non-admins to home.
- [x] 7.2 `app/(app)/admin/counted-events.tsx` + `src/features/admin/CountedEventsScreen.tsx`:
  - Top: last sync time + outcome badge + "Resync now" button (calls `triggerCalendarSync`).
  - Middle: list of patterns with delete buttons + "Add pattern" input.
  - Bottom: preview "Upcoming counted events (next 14 days)" reading `events` filtered by `is_counted=true` and future start.

## 8. Translations

- [x] 8.1 Extend locales under `admin.countedEvents.*` (en/ar/de): title, lastSync, neverSynced, resync, resyncQueued, relative-time helpers (justNow / minutesAgo / hoursAgo / daysAgo with plural rules), outcome.{success,error,running}, patterns.{title,add,placeholder,empty,removeA11y}, preview.{title,empty}, errors.{rateLimited,resyncFailed}.

## 9. Tests

- [x] 9.1 Unit (Deno test): JWT signing returns a valid 3-segment token. → `supabase/functions/sync-calendar-events/jwt.test.ts` (also asserts header/claim shape and signature roundtrip). Run with `cd supabase/functions/sync-calendar-events && deno test --allow-net`.
- [x] 9.2 Integration: `match_counted_event` substring + case-insensitivity → `tests/calendar/rpcIntegration.test.ts` (gated on `RUN_INTEGRATION_TESTS=1`). Reclassified from "unit" because the function is pure SQL.
- [x] 9.3 Integration: upserting a counted-event pattern recomputes `is_counted` for all events in window.
- [x] 9.4 Integration: `get_today_events` returns events that span today in Europe/Berlin even if UTC start is yesterday.
- [x] 9.5 Integration: `trigger_calendar_sync` rate-limit blocks second call within a minute (plus admin-only gating).
- [x] 9.x Bonus unit suite: `tests/calendar/eventsService.test.ts` mocks `supabase.rpc/from` to confirm wrappers send the right RPC name + payload (mirrors `tests/persons/personsService.test.ts`).

## 10. Verification (in Expo Go)

> Sections 1–9 are implemented in code. Section 10 is user-driven —
> requires a real Google Cloud project, service account key, and
> Supabase secrets; cannot be automated.

- [x] 10.1 Configure service account; populate calendar with three events: "Sunday Liturgy 2026-04-26", "Bible Study 2026-04-29", "Choir Practice 2026-04-28". (Follow `docs/google-calendar-setup.md`.)
- [x] 10.2 Manual sync via Edge Function: `events` table contains the three rows with correct timestamps.
- [x] 10.3 As admin, open Counted Events screen (Home → ⋮ menu → Counted events) → add pattern "Liturgy" → save → preview lists Sunday Liturgy as counted.
- [x] 10.4 Add a second pattern "Bible" → preview now also lists Bible Study.
- [x] 10.5 Remove "Bible" pattern → recompute → Bible Study no longer counted.
- [x] 10.6 As servant, attempt to navigate to /admin/counted-events → redirected.
- [x] 10.7 `openspec validate add-google-calendar-sync` passes.
