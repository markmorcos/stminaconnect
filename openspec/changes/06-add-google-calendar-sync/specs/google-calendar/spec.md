## ADDED Requirements

### Requirement: Background sync of Google Calendar events

The system SHALL pull events from a configured Google Calendar (via service-account authentication) at least once per hour, upsert them into the `events` table, and archive any local event no longer present in the upstream window.

#### Scenario: Hourly sync picks up new event

- **GIVEN** a new event "Friday Vespers" is created in the upstream Google Calendar
- **WHEN** the hourly `calendar-sync` Edge Function runs
- **THEN** a row appears in `events` with the matching `title`, `start_at`, `end_at`, and `synced_at = now()`

#### Scenario: Deleted upstream event is archived locally

- **GIVEN** an event existed locally with `google_event_id = X` and is still within the sync window
- **AND** it is deleted from upstream
- **WHEN** `calendar-sync` runs
- **THEN** the local row has `archived_at` set to the sync time

#### Scenario: Edited upstream event is updated locally

- **GIVEN** an event exists locally with `title = 'Sunday Liturgy'` and `start_at = 10:00`
- **AND** it is edited upstream to `start_at = 10:30`
- **WHEN** `calendar-sync` runs
- **THEN** the local row reflects `start_at = 10:30`

#### Scenario: Idempotent sync

- **GIVEN** `calendar-sync` completes once successfully
- **WHEN** it is run again immediately with no upstream changes
- **THEN** no rows change; `synced_at` is refreshed but other data is equivalent

### Requirement: Counted-event patterns drive `is_counted`

Admins SHALL configure a list of case-insensitive title substring patterns. An event's `is_counted` SHALL be true if and only if its title contains at least one non-archived pattern (substring match, case-insensitive).

#### Scenario: Pattern matches event

- **GIVEN** a pattern `sunday liturgy` exists
- **AND** an event titled `Sunday Liturgy — Easter`
- **WHEN** the sync runs
- **THEN** the event's `is_counted` is `true`

#### Scenario: Pattern does not match

- **GIVEN** patterns `sunday liturgy` and `friday vespers`
- **AND** an event titled `Youth Movie Night`
- **THEN** `is_counted` is `false`

#### Scenario: Adding a pattern recomputes existing events

- **GIVEN** an event `Choir Practice` exists with `is_counted = false`
- **WHEN** an admin adds pattern `choir`
- **THEN** the event's `is_counted` flips to `true` immediately (via the recompute trigger), without waiting for the next sync

#### Scenario: Archiving a pattern recomputes

- **GIVEN** events matching pattern `choir practice` are currently counted
- **WHEN** an admin archives that pattern
- **THEN** those events' `is_counted` flips to `false`

### Requirement: Admin-only pattern management

Only admins SHALL be able to INSERT, UPDATE, or archive rows in `counted_event_patterns`. Servants SHALL be able to SELECT (to render read-only views if needed in dashboards later).

#### Scenario: Servant cannot add pattern

- **GIVEN** an authenticated servant
- **WHEN** they INSERT into `counted_event_patterns`
- **THEN** RLS blocks the operation

### Requirement: Client event access via RPCs

The mobile app SHALL fetch events via `list_todays_events()` and `list_events_between(from, to)` RPCs, which return only non-archived events.

#### Scenario: Today's events in Europe/Berlin

- **GIVEN** local time in Berlin is 2026-04-19 08:00
- **WHEN** `list_todays_events()` is called
- **THEN** it returns events whose `start_at` falls between 2026-04-19 00:00 and 23:59:59 Berlin time (converted to UTC)
- **AND** archived events are excluded

### Requirement: Credentials never reach the mobile client

`GOOGLE_SERVICE_ACCOUNT_JSON` SHALL only be present in the backend environment (Edge Function secrets). The mobile app SHALL have no knowledge of Google API endpoints or credentials.

#### Scenario: Mobile bundle audit

- **GIVEN** the compiled mobile bundle
- **WHEN** grepped for `googleapis.com`, `service_account`, `private_key`
- **THEN** no matches are found
