## Why

Attendance cannot be recorded without knowing which events exist. The app deliberately does not create events — the church already maintains its schedule in Google Calendar. We need a background job that pulls calendar events into a Supabase table, cached for fast client lookup, with a configurable set of "counted event" title patterns that drive absence detection later.

## What Changes

- **ADDED** `google-calendar` capability:
  - `events` table in Postgres: `id` (PK = `google_event_id`), `title`, `start_at`, `end_at`, `location`, `is_counted` (derived), `synced_at`.
  - `counted_event_patterns` table: admin-configurable list of title substrings (case-insensitive) that flag an event as counted.
  - `calendar-sync` Edge Function: authenticates via service account, fetches events from Google Calendar for a rolling window (30 days back, 30 days forward), upserts into `events`, recomputes `is_counted` for each event.
  - `pg_cron` schedule: invoke `calendar-sync` hourly.
  - RPCs: `list_events_between(start, end)`, `list_todays_events()`.
  - Admin settings UI: manage counted-event patterns (add/remove/edit).
- Foundation only; attendance check-in UI lands in the next change.

## Impact

- **Affected specs:** `google-calendar` (new), `settings` (MODIFIED — adds counted-event patterns section)
- **Affected code (preview):**
  - Migrations: `008_create_events.sql`, `009_counted_event_patterns.sql`, `010_event_rpcs.sql`, `011_pg_cron_calendar_sync.sql`
  - Edge Function: `supabase/functions/calendar-sync/`
  - Mobile: `services/api/events.ts`, `features/settings/screens/counted-events.tsx`, Settings tab entry
  - Env vars: `GOOGLE_CALENDAR_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`
- **Breaking changes:** none.
- **Migration needs:** yes, 4 new migrations.
- **Depends on:** `add-servant-auth`, `add-person-data-model`, `add-i18n-foundation` (for settings screen strings).
