# attendance Specification

## Purpose

Defines the online check-in flow used to mark attendance against events from the calendar mirror. Attendance is recorded as one row per (event, person) marked present; absence is implicit (no row). Mutations are gated by a Berlin-cutoff edit window and batched into a single round-trip per save. The roster surfaces the servant's assigned "My Group" alongside a search affordance for marking non-assigned persons. Online-only at this phase — `add-offline-sync-with-sqlite` (phase 13) adds the offline queue.

## Requirements

### Requirement: Attendance SHALL be recorded as `(event, person)` rows; absence is implicit.

Each present check-in MUST be one row in `attendance` with `is_present=true`. Absence MUST be modeled as the absence of such a row — the system SHALL NOT persist explicit "did not attend" rows. The unique constraint `(event_id, person_id)` MUST be enforced at the schema level so that one row per (event, person) is guaranteed regardless of how many times the toggle is hit.

#### Scenario: Schema enforces uniqueness

- **GIVEN** an `attendance` row exists for `(E, P)`
- **WHEN** an INSERT for the same `(E, P)` is attempted
- **THEN** it is rejected by the unique constraint (or coerced into an upsert by the RPC)

#### Scenario: Absent persons have no row

- **GIVEN** an event E with persons P1 and P2 in the church
- **AND** P1 is checked in for E; P2 is not
- **THEN** `select * from attendance where event_id=E` returns exactly one row, for P1

### Requirement: The Check In flow SHALL start from the home screen and reach a roster in two taps.

A "Check In" tile MUST be a primary CTA on the home screen. Tapping it opens the event picker; tapping an event opens the roster. No additional confirmation steps in between.

#### Scenario: Home → roster in two taps

- **GIVEN** today has a counted event "Sunday Liturgy" at 10:00
- **AND** the servant is signed in
- **WHEN** the servant taps "Check In" then taps "Sunday Liturgy"
- **THEN** the roster for that event is visible
- **AND** the My Group section lists the servant's assigned persons

### Requirement: The roster SHALL load My Group with attendance states pre-applied.

On entering the roster, the screen MUST fetch the servant's assigned persons and `get_event_attendance(event_id)` in parallel. Persons already marked present for the event MUST appear with their check state set. Toggling a row updates only local pending state until Save.

#### Scenario: Pre-existing check states reflected on entry

- **GIVEN** event E with attendance rows already in DB for P1 and P3 from the servant's group
- **WHEN** the servant enters the E roster
- **THEN** P1 and P3 show as checked
- **AND** other group members show as unchecked

#### Scenario: Toggle is local until Save

- **GIVEN** the roster is open with P1 checked
- **WHEN** the servant taps P1
- **THEN** P1 visually unchecks
- **AND** the Save FAB shows "Save (1 change)"
- **AND** the database row for `(E, P1)` still exists at this moment

### Requirement: Save SHALL batch all pending changes into one round-trip.

Tapping Save MUST persist pending check-in changes for the active event. From this change forward, Save MUST enqueue `mark_attendance` and `unmark_attendance` ops into `local_sync_queue` and update the local SQLite `attendance` cache optimistically — the actual RPC dispatch is owned by the SyncEngine. UI feedback ("Saved") MUST NOT depend on the network round-trip; the sync indicator reflects the queued state until the SyncEngine drains it.

#### Scenario: Save updates local immediately

- **GIVEN** the roster has pending toggles
- **WHEN** the user taps Save
- **THEN** the local `attendance` table is updated within the same UI frame
- **AND** the corresponding ops are added to `local_sync_queue`
- **AND** the Save FAB hides
- **AND** the indicator reflects pending sync

#### Scenario: Save offline still succeeds locally

- **GIVEN** the device is offline
- **AND** the roster has pending toggles
- **WHEN** the user taps Save
- **THEN** the local cache is updated
- **AND** ops are queued
- **AND** the user receives a localized "Saved" confirmation (no network error surfaced)

### Requirement: A "Find someone else" search SHALL allow marking any non-deleted person.

A search input on the roster MUST query `search_persons(query)` (debounced 300ms, ≤25 results). Tapping a search result adds the person to the My Group section's pending set in the same toggle semantics. Search results MUST exclude soft-deleted persons.

#### Scenario: Search adds outside-group person to pending

- **GIVEN** servant S signed in; person X is NOT in S's My Group
- **WHEN** S types "Mariam" and taps the matching X result
- **THEN** X appears in the roster with checked state pending
- **AND** Save persists the attendance row

#### Scenario: Soft-deleted persons not in results

- **GIVEN** person X has been soft-deleted
- **WHEN** any servant searches for X by name
- **THEN** X does not appear in results

### Requirement: The edit window SHALL close at 03:00 Europe/Berlin the day after the event.

`mark_attendance` and `unmark_attendance` MUST verify
`now() < event.start_at + (1 + alert_config.grace_period_days) days at 03:00 Berlin`
before applying changes. The roster screen's local pre-check
(`isEventWithinEditWindow`) MUST receive `graceDays` from `alert_config`
and apply the same offset so client and server agree.

When `grace_period_days = 0`, behavior is identical to the original
"03:00 next-day Berlin" cutoff. When `grace_period_days > 0`, the
window slides forward by that many days — letting servants backfill
attendance for events that the absence-detection streak is also
ignoring within the same window.

#### Scenario: Mark inside window succeeds (grace = 0)

- **GIVEN** event E with `start_at = '2026-04-26 10:00 Europe/Berlin'`
- **AND** `alert_config.grace_period_days = 0`
- **AND** current time is `2026-04-27 02:59 Europe/Berlin`
- **WHEN** `mark_attendance(E, [P1])` is called
- **THEN** the row is inserted

#### Scenario: Mark outside window rejected (grace = 0)

- **GIVEN** event E from above
- **AND** `alert_config.grace_period_days = 0`
- **AND** current time is `2026-04-27 03:01 Europe/Berlin`
- **WHEN** `mark_attendance(E, [P1])` is called
- **THEN** the call returns an error
- **AND** no row is inserted

#### Scenario: Mark inside extended window succeeds (grace > 0)

- **GIVEN** event E with `start_at = '2026-04-23 10:00 Europe/Berlin'`
- **AND** `alert_config.grace_period_days = 5`
- **AND** current time is `2026-04-27 02:00 Europe/Berlin`
- **WHEN** `mark_attendance(E, [P1])` is called
- **THEN** the row is inserted (cutoff is `2026-04-29 03:00 Berlin`, comfortably future)

#### Scenario: Roster pre-check matches the server cutoff

- **GIVEN** `alert_config.grace_period_days = 3`
- **AND** the roster screen has fetched alert config
- **WHEN** the screen renders for an event 2 days old
- **THEN** `isEventWithinEditWindow(eventId, 3)` returns `true`
- **AND** rows are tappable; the Save FAB is rendered

### Requirement: Roster updates SHALL be observable to other servants on next reload.

This phase is online-only and intentionally MUST NOT subscribe to attendance Realtime. After a successful save, other servants currently viewing the same roster SHALL see the new state on the next refetch (screen re-entry or pull-to-refresh). Realtime cross-servant updates are explicitly deferred to a later phase.

#### Scenario: Cross-servant visibility on refetch

- **GIVEN** servants S1 and S2 both viewing event E's roster
- **WHEN** S1 marks P1 and saves
- **AND** S2 pulls to refresh
- **THEN** P1 appears as checked in S2's view

### Requirement: The check-in picker SHALL surface events from the past `grace_period_days` so servants can backfill.

The attendance picker (`/attendance`) MUST query events in the window
`[today − grace_period_days, today + 1 day)` (device timezone) and
render them sorted by `start_at` ascending. The screen title SHALL be
"Recent events" (EN) / "Aktuelle Veranstaltungen" (DE) /
"الاجتماعات الأخيرة" (AR), since the list now spans more than today.

For events that do not fall on the current day, each tile SHALL render
a date prefix (e.g., "Sat, Apr 25 · 09:00 – 10:30") so servants
visually distinguish past events from today's.

The picker MUST gracefully fall back to a default of 3 days when the
`get_alert_config` RPC fails (offline, RLS hiccup) — matching the
migration default and keeping the screen useful when config is
unreachable.

#### Scenario: Picker includes past-grace events

- **GIVEN** `alert_config.grace_period_days = 3`
- **AND** counted events exist 2 days ago, 1 day ago, today
- **WHEN** the picker loads
- **THEN** all three events are listed
- **AND** the past events show a date prefix
- **AND** the today event shows time only

#### Scenario: Picker fallback when config unreachable

- **GIVEN** the device is offline (no cached `alert_config`)
- **WHEN** the picker loads
- **THEN** events from the past 3 days plus today are shown
- **AND** no error banner is displayed

#### Scenario: Title localization

- **WHEN** the picker is rendered with the active language set to EN, DE, or AR
- **THEN** the title reads "Recent events", "Aktuelle Veranstaltungen", or "الاجتماعات الأخيرة" respectively
- **AND** the empty state copy matches the same locale's "No recent events." key
