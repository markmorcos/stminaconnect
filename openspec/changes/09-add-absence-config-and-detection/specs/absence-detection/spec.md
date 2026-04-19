## ADDED Requirements

### Requirement: Absence configuration

The system SHALL maintain a singleton `absence_config` row holding `default_threshold`, `admin_gets_alerts`, and `alert_priority_thresholds` (a JSONB map from priority to integer threshold).

#### Scenario: Default seeded

- **GIVEN** a freshly migrated database
- **WHEN** the `absence_config` table is queried
- **THEN** exactly one row exists with `default_threshold = 3`, `admin_gets_alerts = true`, and `alert_priority_thresholds = { high: 2, medium: 3, low: 4, very_low: 6 }`

#### Scenario: Only admins can update

- **GIVEN** a servant
- **WHEN** they attempt to update `absence_config`
- **THEN** RLS blocks the update

### Requirement: Streak computation over counted events

For any active person, the system SHALL compute "absence streak" as the number of consecutive counted events with `start_at >= person.registered_at` that the person did not attend, since their most recent attended counted event (or since `registered_at` if they've never attended).

#### Scenario: Basic streak

- **GIVEN** counted events C1 < C2 < C3 < C4 and a person registered before C1
- **AND** the person attended C1 only
- **WHEN** detection runs after C4
- **THEN** the person's streak equals 3 (C2, C3, C4 missed)

#### Scenario: Non-counted events don't reset

- **GIVEN** counted events C1 < C2 < C3; non-counted event NC1 between C2 and C3
- **AND** the person attended C1 and NC1 only
- **WHEN** detection runs after C3
- **THEN** streak equals 2 (C2 and C3 missed)

#### Scenario: New member grace

- **GIVEN** a person `registered_at = 2026-04-10` and counted events C on `2026-04-05` and `2026-04-12`
- **AND** the person has not attended any counted event
- **WHEN** detection runs on 2026-04-12 evening
- **THEN** streak equals 1 (only C on 2026-04-12 counts; the 2026-04-05 event predates registration)

#### Scenario: Non-counted attendance doesn't create a streak reset

*(redundant with "Non-counted events don't reset" — kept for clarity)*

- **GIVEN** the person attended only a non-counted event since their last counted-event attendance
- **THEN** the streak reflects counted misses only

### Requirement: Alerting at priority-specific threshold

When a person's streak reaches the threshold for their priority (or `default_threshold` if no priority-specific value), AND no `open` alert exists for that person, an `absence_alerts` row SHALL be inserted with `status = 'open'`, `triggered_at = now()`, `event_id_triggering` set to the most recent missed event, `assigned_servant_id` snapshot.

#### Scenario: High-priority triggers at 2 misses

- **GIVEN** `alert_priority_thresholds.high = 2`
- **AND** Maria has priority `high` and streak = 2
- **WHEN** detection runs
- **THEN** a new `absence_alerts` row is created for Maria with `streak_length = 2`

#### Scenario: Low-priority ignored at streak 3

- **GIVEN** `alert_priority_thresholds.low = 4`
- **AND** a person with priority `low` and streak = 3
- **WHEN** detection runs
- **THEN** no alert is created

#### Scenario: Deduplication

- **GIVEN** an `open` alert already exists for a person
- **WHEN** detection runs again with the same (or higher) streak
- **THEN** no new alert is created
- **AND** the existing alert's `streak_length` MAY be updated but `triggered_at` MUST NOT change

#### Scenario: Resolved alert allows a future alert

- **GIVEN** a previously `resolved` alert exists for the person
- **AND** the person then misses enough counted events to cross threshold again
- **WHEN** detection runs
- **THEN** a new `open` alert is created

### Requirement: Detection invocation

`detect-absences` Edge Function SHALL:
- Run automatically at the end of every `calendar-sync` that found new/changed counted events.
- Run on a daily schedule at 23:00 Europe/Berlin.
- Be invocable on demand by admins via a "Re-detect now" button.

#### Scenario: Automatic invocation after sync

- **GIVEN** `calendar-sync` completed and at least one counted event was added/modified
- **WHEN** the sync function returns
- **THEN** `detect-absences` is invoked
- **AND** new alerts are present in `absence_alerts` within seconds

#### Scenario: Daily invocation

- **WHEN** clock reaches 23:00 Berlin
- **THEN** `detect-absences` runs even if no sync occurred that day

#### Scenario: Admin on-demand

- **GIVEN** admin taps "Re-detect now"
- **WHEN** the request completes
- **THEN** a toast reports "N alerts generated" (N may be 0)

### Requirement: Recompute on retroactive attendance edit

When attendance is marked or unmarked for a past event, `recompute_absence_for_person` SHALL re-run the streak calculation for that person only and add/remove alerts accordingly.

#### Scenario: Unmark lowers streak below threshold

- **GIVEN** a person has an `open` alert; a servant marks them attended for a past counted event they had missed
- **WHEN** `recompute_absence_for_person` runs
- **THEN** the streak drops below threshold
- **AND** the `open` alert's `status` becomes `'resolved'` with `resolved_at = now()`

#### Scenario: Manual retroactive unmark creates an alert

- **GIVEN** a person who was marked as attending a counted event, and no open alert
- **WHEN** an admin unmarks that attendance and `recompute_absence_for_person` runs
- **THEN** if their new streak meets threshold, an alert is created

### Requirement: Alerts readable only by assignee + admins

RLS on `absence_alerts` SHALL allow SELECT only to the currently assigned servant of the person and to admins. No direct writes from clients.

#### Scenario: Servant reads own alerts

- **GIVEN** servant A is assigned to Maria who has an open alert
- **WHEN** A queries `absence_alerts` with filter on their own id
- **THEN** Maria's alert is returned

#### Scenario: Servant cannot read others' alerts

- **GIVEN** servant A; Maria is assigned to servant B
- **WHEN** A queries `absence_alerts`
- **THEN** Maria's alert is not in the result
