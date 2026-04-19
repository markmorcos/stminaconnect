## MODIFIED Requirements

### Requirement: Person detail screen

The Person detail tab bar SHALL include a "Follow-Up" tab alongside Info, Attendance, Comments. The Follow-Up tab content is defined in the `follow-up` capability. The header SHALL also display an "On break until [date]" pill when applicable.

#### Scenario: Tabs include Follow-Up

- **WHEN** a user opens a Person detail
- **THEN** four tabs are present: Info, Attendance, Comments, Follow-Up

#### Scenario: On-break pill

- **GIVEN** Maria has `on_break = true, on_break_until = 2026-05-15`
- **WHEN** the header renders
- **THEN** a pill below the name reads "On break until May 15, 2026" (localized)
- **AND** if break has expired, no pill is shown

### Requirement: On-break action

The Person header overflow menu SHALL include "Mark on break" (for the assigned servant and admins) and "Clear break" when break is active. The action opens a date picker (max 180 days ahead) and writes via the sync layer.

#### Scenario: Mark on break

- **GIVEN** servant A on Maria's profile (A is assigned)
- **WHEN** A taps Mark on break → 2026-05-15 → Confirm
- **THEN** a local update sets `on_break = true`, `on_break_until = 2026-05-15`
- **AND** a `sync_outbox` entry queues the server update
- **AND** the header shows the pill

#### Scenario: Clear break

- **GIVEN** Maria is on break
- **WHEN** the assigned servant taps "Clear break"
- **THEN** `on_break = false`, `on_break_until = null`
- **AND** the pill disappears

#### Scenario: Unassigned servant cannot mark on break

- **GIVEN** servant B not assigned to Maria
- **WHEN** B opens the overflow menu
- **THEN** "Mark on break" is not listed
