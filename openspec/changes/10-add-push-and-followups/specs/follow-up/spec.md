## ADDED Requirements

### Requirement: Follow-Ups tab

The authenticated tab bar SHALL include a "Follow-Ups" tab that lists the current user's open alerts, grouped: Overdue (triggered > 48h ago), Recent (≤ 48h), and Snoozed.

#### Scenario: Lists alerts for the current servant

- **GIVEN** servant A has 2 open alerts (one triggered 3 days ago, one triggered this morning)
- **WHEN** they open Follow-Ups
- **THEN** the 3-day-old alert is under "Overdue"
- **AND** the morning one is under "Recent"
- **AND** each row shows person's name, priority badge, time since triggered

#### Scenario: Empty state

- **WHEN** the servant has no open alerts
- **THEN** the screen shows "All caught up! No follow-ups pending."

### Requirement: Log a follow-up action

Tapping an alert SHALL open a form with: segmented action picker (`Called`, `Texted`, `Visited`, `NoAnswer`, `Other`), optional notes field, Completed / Snoozed buttons.

#### Scenario: Log a Called follow-up

- **GIVEN** the form is open for Maria's alert
- **WHEN** the servant selects `Called`, types "Maria was at work" in notes, taps Completed
- **THEN** a `follow_ups` row is created with action=Called, status=Completed, notes captured
- **AND** the alert's status becomes `resolved` (`resolved_at = now()`)
- **AND** the alert is removed from the Follow-Ups list

#### Scenario: Log a NoAnswer

- **WHEN** the servant selects `NoAnswer` and taps Completed
- **THEN** a follow-up row is created
- **AND** the alert's status remains `open` (no answer doesn't resolve)
- **AND** the Follow-Ups list continues to show the alert but with a "Tried — no answer" subtitle

#### Scenario: Snooze

- **WHEN** the servant taps Snoozed (any action type)
- **THEN** a `follow_ups` row is created with status=Snoozed
- **AND** the alert moves to the "Snoozed" group on the Follow-Ups list
- **AND** the alert stays `open`

### Requirement: Offline follow-up log

Follow-up creation, snooze, and completion SHALL work offline via `sync_outbox`.

#### Scenario: Offline complete

- **GIVEN** the device is offline
- **WHEN** the servant logs a Called / Completed follow-up
- **THEN** locally the alert is marked resolved and the row disappears from Follow-Ups
- **AND** a `sync_outbox` entry is queued
- **AND** on reconnect the server reflects the same state

### Requirement: On-break state

A member profile SHALL expose an "On break" action (assigned servant or admin) that sets `on_break = true` and `on_break_until = <date>` (max 180 days ahead). The Person detail header SHALL show "On break until [date]" when active.

#### Scenario: Mark on break

- **GIVEN** servant A on Maria's profile
- **WHEN** A taps Mark on break → picks 2026-05-15 → confirms
- **THEN** `on_break = true`, `on_break_until = 2026-05-15`
- **AND** header shows "On break until May 15, 2026" (localized)

#### Scenario: Break pauses detection

- **GIVEN** Maria is on break until 2026-05-15
- **AND** she misses 3 counted events between now and then
- **WHEN** `run_absence_detection` runs
- **THEN** no alert is created for Maria

#### Scenario: Break expires automatically

- **GIVEN** Maria's `on_break_until = 2026-05-15`
- **WHEN** the current date is 2026-05-16
- **THEN** detection treats Maria normally (break is ignored)
- **AND** a nightly cleanup sets `on_break = false` cosmetically

### Requirement: Follow-ups visible on person profile

The Person detail "Follow-Up" tab SHALL list all follow-ups recorded for this person (newest first), visible to the assigned servant and admins. Anyone else SHALL see a locked state consistent with comment privacy.

#### Scenario: Assigned servant sees all follow-ups

- **GIVEN** Maria has 3 follow-up entries
- **WHEN** servant A (assigned) opens the Follow-Up tab on Maria's profile
- **THEN** all 3 entries render

#### Scenario: Unassigned servant sees lock state

- **GIVEN** servant A not assigned to Maria
- **WHEN** A opens the Follow-Up tab
- **THEN** a lock state reads "Follow-ups are visible to the assigned servant."
