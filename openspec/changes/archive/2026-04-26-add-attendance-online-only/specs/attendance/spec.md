# attendance — Spec Delta

## ADDED Requirements

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

Tapping Save MUST call `mark_attendance` (for newly added person ids) and `unmark_attendance` (for removed ones) in parallel via Promise.all. Both calls MUST occur in the same network burst. On any failure, both pending sets MUST be retained for retry.

#### Scenario: Save batches add and remove

- **GIVEN** the servant has toggled P2 on and P1 off in the roster
- **WHEN** the servant taps Save
- **THEN** `mark_attendance(E, [P2])` and `unmark_attendance(E, [P1])` are dispatched in parallel
- **AND** on completion, both DB states reflect the changes
- **AND** the FAB hides

#### Scenario: Save failure preserves pending

- **GIVEN** pending changes exist
- **AND** the network is unavailable
- **WHEN** the servant taps Save
- **THEN** an error Snackbar appears (translated)
- **AND** the pending sets are unchanged
- **AND** the Save FAB still shows the change count

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

`mark_attendance` and `unmark_attendance` MUST verify `now() < event.start_at + 1 day at 03:00 Berlin` before applying changes. Outside the window, both RPCs return an error. The roster screen MUST detect the closed window via `is_event_within_edit_window` and switch to read-only mode with a banner indicating the cutoff.

#### Scenario: Mark inside window succeeds

- **GIVEN** event E with `start_at = '2026-04-26 10:00 Europe/Berlin'`
- **AND** current time is `2026-04-27 02:59 Europe/Berlin`
- **WHEN** `mark_attendance(E, [P1])` is called
- **THEN** the row is inserted

#### Scenario: Mark outside window rejected

- **GIVEN** event E from above
- **AND** current time is `2026-04-27 03:01 Europe/Berlin`
- **WHEN** `mark_attendance(E, [P1])` is called
- **THEN** the call returns an error
- **AND** no row is inserted

#### Scenario: Closed window roster is read-only

- **GIVEN** event E whose edit window has closed
- **WHEN** the roster for E is opened
- **THEN** a banner reads "This event is no longer editable" with the cutoff timestamp
- **AND** tapping rows does nothing
- **AND** no Save FAB is rendered

### Requirement: Roster updates SHALL be observable to other servants on next reload.

This phase is online-only and intentionally MUST NOT subscribe to attendance Realtime. After a successful save, other servants currently viewing the same roster SHALL see the new state on the next refetch (screen re-entry or pull-to-refresh). Realtime cross-servant updates are explicitly deferred to a later phase.

#### Scenario: Cross-servant visibility on refetch

- **GIVEN** servants S1 and S2 both viewing event E's roster
- **WHEN** S1 marks P1 and saves
- **AND** S2 pulls to refresh
- **THEN** P1 appears as checked in S2's view
