# google-calendar — Spec Delta

## ADDED Requirements

### Requirement: Events SHALL be sourced exclusively from the church's Google Calendar.

The app MUST NOT create, edit, or delete Google Calendar events. The `sync-calendar-events` Edge Function pulls from a single calendar identified by `GOOGLE_CALENDAR_ID` and upserts into the `events` table. The mirror is the only source of event data the mobile client consumes.

#### Scenario: Sync inserts new events

- **GIVEN** the Google Calendar contains a "Sunday Liturgy" event next Sunday at 10:00
- **AND** the `events` table is empty
- **WHEN** `sync-calendar-events` runs
- **THEN** an `events` row exists with the matching `google_event_id`, `title='Sunday Liturgy'`, and the correct `start_at`/`end_at`

#### Scenario: Sync updates changed events

- **GIVEN** the Google Calendar event for "Bible Study 2026-04-29" was moved to 18:00
- **AND** the `events` table previously had its `start_at` at 19:00
- **WHEN** `sync-calendar-events` runs
- **THEN** the matching row's `start_at` is updated to 18:00
- **AND** `synced_at` reflects the run

#### Scenario: Sync removes deleted events from the rolling window

- **GIVEN** an event in the `events` table within the rolling window has been deleted from Google Calendar
- **WHEN** `sync-calendar-events` runs
- **THEN** the event is removed from `events` (or soft-deleted via a `deleted_at` extension — implementation choice as long as it disappears from `get_today_events`)

### Requirement: The sync window SHALL be 30 days past + 14 days future.

The Edge Function MUST request only events with `timeMin = now() - 30 days` and `timeMax = now() + 14 days`. Events outside the window MUST NOT be persisted.

#### Scenario: Past 30-day boundary excluded

- **GIVEN** an event 31 days in the past in Google Calendar
- **WHEN** sync runs
- **THEN** no row is created for that event

### Requirement: Counted-event status SHALL be derived from admin-configured patterns.

A persisted boolean `is_counted` on each `events` row MUST equal `match_counted_event(title)` at the time of sync. Pattern matching is case-insensitive substring across all configured patterns (OR'd). Adding or removing a pattern MUST recompute `is_counted` for every event in the rolling window before the RPC returns.

#### Scenario: Adding a pattern recomputes window

- **GIVEN** events "Sunday Liturgy", "Bible Study", "Choir Practice" with `is_counted=false` for all
- **WHEN** an admin calls `upsert_counted_event_pattern('Liturgy')`
- **THEN** "Sunday Liturgy" has `is_counted=true`
- **AND** the others remain `false`

#### Scenario: Removing a pattern recomputes window

- **GIVEN** patterns 'Liturgy' and 'Bible' both present, both events counted
- **WHEN** an admin deletes pattern 'Bible'
- **THEN** "Bible Study" has `is_counted=false`
- **AND** "Sunday Liturgy" remains `true`

#### Scenario: Pattern matching is case-insensitive

- **GIVEN** pattern `liturgy`
- **AND** event title `Holy Week LITURGY`
- **WHEN** `match_counted_event('Holy Week LITURGY')` is called
- **THEN** it returns `true`

### Requirement: Sync SHALL run automatically every 30 minutes and be triggerable manually by admins.

A `pg_cron` schedule MUST invoke the Edge Function every 30 minutes. Admins MUST be able to trigger an immediate sync via `trigger_calendar_sync()`. Manual triggers MUST be rate-limited to one call per minute per admin.

#### Scenario: Manual trigger initiates sync

- **GIVEN** an admin signed in
- **WHEN** the admin taps "Resync now" on the counted-events screen
- **THEN** `trigger_calendar_sync()` is called
- **AND** within 5 seconds, a new `sync_log` row exists with outcome `success` (assuming valid setup)

#### Scenario: Manual trigger rate-limited

- **GIVEN** an admin already triggered a sync 10 seconds ago
- **WHEN** the admin taps "Resync now" again
- **THEN** the RPC returns an error indicating rate limit
- **AND** no new sync_log row is created

### Requirement: `get_today_events` SHALL return events whose start falls within today in Europe/Berlin.

The RPC MUST compute `start of day` and `end of day` in `Europe/Berlin` and return events with `start_at >= start AND start_at < end`. Events whose UTC start is yesterday but Berlin start is today MUST be returned. Ordering: ascending by `start_at`.

#### Scenario: Berlin midnight crossover

- **GIVEN** an event with `start_at = '2026-04-26 22:30:00 UTC'`
- **AND** Europe/Berlin is currently in CEST (UTC+2)
- **AND** "today" in Berlin is `2026-04-27`
- **THEN** the event whose Berlin-local start is `2026-04-27 00:30` is returned by `get_today_events`

#### Scenario: Today returns no events when calendar empty

- **GIVEN** no events fall on today in Berlin time
- **WHEN** `get_today_events` is called
- **THEN** the result is empty

### Requirement: Counted-event patterns SHALL be admin-only.

`list_counted_event_patterns` MAY be called by any signed-in servant for read access (used by future phases). `upsert_counted_event_pattern`, `delete_counted_event_pattern`, and `trigger_calendar_sync` MUST be admin-only and reject non-admin callers.

#### Scenario: Non-admin upsert rejected

- **GIVEN** servant S (non-admin) signed in
- **WHEN** S calls `upsert_counted_event_pattern('Vespers')`
- **THEN** the call returns a permission error
- **AND** no pattern row is created

### Requirement: The admin screen SHALL surface last sync status.

`app/(app)/admin/counted-events.tsx` MUST display the timestamp and outcome of the most recent sync_log row. If a sync has never run, the screen displays a localized "Never synced" placeholder. The screen MUST be admin-only; non-admins are redirected.

#### Scenario: Sync status visible after a successful run

- **GIVEN** a sync ran 5 minutes ago with outcome `success`
- **WHEN** an admin opens the counted-events screen
- **THEN** the top of the screen shows "Last sync: 5 minutes ago — Success"

#### Scenario: Non-admin redirected from admin route

- **GIVEN** non-admin servant S
- **WHEN** S navigates to `/admin/counted-events`
- **THEN** S is redirected to the home screen
