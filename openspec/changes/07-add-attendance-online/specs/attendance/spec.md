## ADDED Requirements

### Requirement: Check-In tab

The authenticated tab bar SHALL include a "Check In" tab that shows today's events (Europe/Berlin) on entry.

#### Scenario: Today's events listed

- **GIVEN** an authenticated servant
- **WHEN** they open the Check In tab
- **THEN** today's non-archived events are listed, sorted by `start_at` ascending
- **AND** each row shows title, time, location (if present), and whether the event `is_counted` (subtle indicator)

#### Scenario: No events today

- **GIVEN** no events are scheduled for today
- **WHEN** the tab opens
- **THEN** the screen shows an empty state "No services scheduled today"

### Requirement: Event roster shows assigned members first, with search across all

The event roster SHALL default to showing the current user's assigned members (unmarked rows on top, marked rows below a divider). A search bar SHALL expand results to any active member.

#### Scenario: Default view

- **GIVEN** servant A has 12 assigned members
- **WHEN** they open the roster for today's Sunday Liturgy
- **THEN** up to 12 rows appear under an "Your group" section, separated into unmarked (top) and marked (below divider)
- **AND** a search bar is available

#### Scenario: Search finds any active member

- **GIVEN** the servant types "Maria" in the search bar
- **WHEN** results arrive
- **THEN** all non-archived persons whose name matches appear below, with each indicating whether already marked for this event

### Requirement: Mark attendance is optimistic

Tapping a roster row SHALL flip it to "marked" immediately (optimistic UI) and call `mark_attendance(person_id, event_id)`. On failure, the UI SHALL revert and show a toast.

#### Scenario: Happy path

- **GIVEN** Maria is unmarked for today's event
- **WHEN** the servant taps her row
- **THEN** the row flips to marked with a spinner replaced by a green checkmark on success
- **AND** a single row appears in `attendance` with `person_id = Maria`, `event_id = today's event`, `marked_by = servant`, `marked_at ~ now`

#### Scenario: Failure reverts

- **GIVEN** the request fails (e.g., network blip)
- **WHEN** the server response returns an error
- **THEN** the row reverts to unmarked
- **AND** a toast reports the failure with a Retry action

#### Scenario: Idempotent upsert on duplicate tap

- **GIVEN** servant A has just marked Maria
- **AND** servant B taps Maria's row at nearly the same moment
- **WHEN** both RPCs arrive at the server
- **THEN** exactly one attendance row exists for (Maria, today's event)
- **AND** its `marked_by` reflects whichever write committed last
- **AND** both clients see a success state

### Requirement: Unmark within edit window

Servants SHALL be able to unmark attendance until 23:59:59 Europe/Berlin on the event's day. Outside that window, `unmark_attendance` SHALL return `EDIT_WINDOW_CLOSED`.

#### Scenario: Unmark same day

- **GIVEN** Maria is marked for an event today at 10:00 Berlin time
- **WHEN** the servant long-presses her row at 14:00 and confirms unmark
- **THEN** the row's `archived_at` is set; she reappears as unmarked
- **AND** the row is excluded from `list_attendance_for_event`

#### Scenario: Unmark after midnight blocked

- **GIVEN** Maria was marked yesterday; it is now 00:01 the next day Berlin time
- **WHEN** the servant attempts to unmark
- **THEN** the RPC returns `EDIT_WINDOW_CLOSED`
- **AND** the UI shows "The edit window closed at midnight — contact an admin to edit."

#### Scenario: Admin can unmark any time

- **GIVEN** Maria was marked a week ago
- **WHEN** an admin unmarks via the admin workflow (via Supabase Studio or a future admin UI)
- **THEN** the RPC (called with admin context) succeeds regardless of window

### Requirement: Person attendance history

`list_attendance_for_person(person_id, limit)` SHALL return the person's attendance entries newest first, each with `event_id`, `event_title` (joined), `event_start_at`, `marked_at`, `marked_by`. Archived entries are excluded.

#### Scenario: Recent attendance visible

- **GIVEN** Maria attended 3 events in the last month
- **WHEN** `list_attendance_for_person(maria, 10)` is called
- **THEN** exactly 3 non-archived entries are returned, newest first

### Requirement: Offline tap shows a failure

Attempting to mark attendance while offline SHALL produce the revert + toast path (no queueing). Full offline support is deferred to `add-offline-sync`.

#### Scenario: Offline tap

- **GIVEN** the device reports no connectivity
- **WHEN** the servant taps a row
- **THEN** the optimistic check appears briefly, then reverts
- **AND** a toast reads "You are offline — try again when connected."
