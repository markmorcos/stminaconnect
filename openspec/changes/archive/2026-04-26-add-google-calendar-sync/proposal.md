## Why

The church publishes its event schedule in a Google Calendar maintained by clergy. The app must read events from that calendar — never create them — so the church's existing operational rhythm isn't disrupted. This change brings calendar events into Postgres on a schedule, exposes them via a "today's events" RPC, and adds the admin configuration that decides which events count toward absence streaks.

## What Changes

- **ADDED** capability `google-calendar`.
- **ADDED** `events` table mirroring relevant Google Calendar fields: `google_event_id` (unique), `title`, `description`, `start_at`, `end_at`, `is_counted` (computed at sync time), `synced_at`.
- **ADDED** `counted_event_patterns` table (admin-configurable list of substrings).
- **ADDED** `sync-calendar-events` Edge Function (Deno):
  - Auth: Google service account via JWT.
  - Reads from a Google Calendar configured by `GOOGLE_CALENDAR_ID` env var.
  - Fetches events in a rolling window (30 days past, 14 days future).
  - Upserts into `events` with `is_counted` set per pattern matching.
- **ADDED** `pg_cron` schedule running `sync-calendar-events` every 30 minutes.
- **ADDED** RPC `get_today_events()` returning events whose `start_at` falls within today (Europe/Berlin), ordered by start time.
- **ADDED** RPC `list_counted_event_patterns()` and `upsert_counted_event_pattern(...)` (admin-only).
- **ADDED** Admin settings screen `app/(app)/admin/counted-events.tsx` for CRUD on patterns.
- **ADDED** Helper SQL function `match_counted_event(title text)` used during sync to compute `is_counted`.
- **ADDED** Documentation: how to create a Google service account, share the calendar with it, set the env var.
- **ADDED** Translation keys `admin.countedEvents.*`.

## Impact

- **Affected specs**: `google-calendar` (new), `admin-dashboard` (touched — first admin screen lands here). To keep the spec layout clean, the admin screen's spec lives under `google-calendar` for now and migrates to `admin-dashboard` when phase 13 fleshes that capability out.
- **Affected code**: `supabase/migrations/008_events.sql`, `009_counted_event_patterns.sql`, `010_match_counted_event.sql`. New `supabase/functions/sync-calendar-events/`. New `app/(app)/admin/_layout.tsx`, `app/(app)/admin/counted-events.tsx`. New `src/services/api/events.ts`.
- **Breaking changes**: none.
- **Migration needs**: three migrations + a service account + an env var setup.
- **Expo Go compatible**: yes — this is server-side. Mobile only reads via RPC.
- **Uses design system**: yes — the admin counted-events screen uses design-system tokens and components.
- **Dependencies**: `add-servant-auth`, `add-i18n-foundation`. The `events` table is consumed by the next phase (`add-attendance-online-only`).
