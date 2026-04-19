## 1. Schema

- [ ] 1.1 Migration `008_create_events.sql`: `events` table (PK `google_event_id text`, `title`, `start_at timestamptz`, `end_at timestamptz`, `location text`, `is_counted boolean default false`, `synced_at`, `archived_at`)
- [ ] 1.2 Migration `009_counted_event_patterns.sql`: `counted_event_patterns` table (`id`, `pattern text`, `created_by`, `created_at`, `archived_at`)
- [ ] 1.3 Migration `010_event_rpcs.sql`: `list_events_between(from, to)`, `list_todays_events()` (respects Europe/Berlin), `recompute_is_counted()` trigger on pattern insert/archive
- [ ] 1.4 RLS: events readable by all authenticated users; writable only by service role. Patterns readable by all authenticated, writable only by admin.
- [ ] 1.5 Integration tests for RLS and the recompute trigger

## 2. Edge Function: calendar-sync

- [ ] 2.1 Scaffold `supabase/functions/calendar-sync` (Deno)
- [ ] 2.2 Implement OAuth JWT flow: sign with `djwt`, exchange at `oauth2.googleapis.com`, cache token in-function
- [ ] 2.3 Fetch Google Calendar events for the rolling window; paginate
- [ ] 2.4 Upsert into `events`; compute `is_counted` via pattern match
- [ ] 2.5 Archive events that exist in the window locally but not in the response
- [ ] 2.6 Unit tests (Deno test): token exchange (mocked), pattern matching, idempotency, archive on missing
- [ ] 2.7 Manual end-to-end test: against a real test calendar, verify events land in `events` table

## 3. Scheduled invocation

- [ ] 3.1 Migration `011_pg_cron_calendar_sync.sql`: schedule `calendar-sync` hourly via `cron.schedule` and `supabase_functions.http_request` (pg_net or equivalent)
- [ ] 3.2 Add "Sync now" admin action in settings to invoke on demand

## 4. Mobile

- [ ] 4.1 `services/api/events.ts`: `listEventsBetween`, `listTodaysEvents`
- [ ] 4.2 `services/api/counted-patterns.ts`: `listPatterns`, `addPattern`, `archivePattern`
- [ ] 4.3 `features/settings/screens/counted-events.tsx`: admin-only screen listing patterns + add/remove + a preview "Events matched in next 30 days" powered by `list_events_between` filtered to `is_counted = true`
- [ ] 4.4 Gate the Counted Events section of Settings so servants don't see it
- [ ] 4.5 Add "Sync now" button that calls the Edge Function directly (admin only)
- [ ] 4.6 i18n strings for all new settings text (all three languages)
- [ ] 4.7 Tests: admin sees section, servant doesn't; pattern add/remove updates list; preview reflects changes

## 5. Verification

- [ ] 5.1 Manual: with a real test calendar, add an event "Sunday Liturgy — Test" → after hourly sync (or manual trigger), it appears in today's events with `is_counted = true`
- [ ] 5.2 Manual: admin edits pattern from "Sunday Liturgy" to "Weekly Liturgy" → preview immediately updates (recompute trigger)
- [ ] 5.3 Manual: servant cannot access Counted Events settings
- [ ] 5.4 `make test`, `make lint`, `make typecheck` pass (including Deno tests)
- [ ] 5.5 `openspec validate add-google-calendar-sync` passes
- [ ] 5.6 Walk every scenario in `specs/google-calendar/spec.md` and the delta in `specs/settings/spec.md`
