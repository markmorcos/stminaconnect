# servant-dashboard — Spec Delta

## ADDED Requirements

### Requirement: The non-admin home screen SHALL render four sections in a fixed order.

`app/(app)/index.tsx` MUST display, top to bottom:
1. Quick actions row (Quick Add, Check In, Register full).
2. My Group list.
3. Pending follow-ups card with link to `/follow-ups`.
4. Recent newcomers (30 days).

#### Scenario: All sections present

- **WHEN** a non-admin servant opens the home screen
- **THEN** all four sections are visible in the listed order

### Requirement: My Group SHALL display each assigned person with a streak status colour.

For each person assigned to the signed-in servant, the row MUST show name, region, and a status indicator:
- **Green** if streak is 0 (last counted event attended).
- **Yellow** if streak is between 1 and the applicable threshold (exclusive).
- **Red** if streak is at or above threshold.
- **On break** chip if `status='on_break'` regardless of streak.

The list MUST be sorted Red (highest streak first), Yellow (highest streak first), Green (alphabetical), On break (alphabetical).

#### Scenario: Red person at top of list

- **GIVEN** S is assigned to P1 (streak 5, Red), P2 (streak 1, Yellow), P3 (streak 0, Green)
- **WHEN** S opens home
- **THEN** the My Group section lists P1 first, P2 second, P3 third

#### Scenario: On-break person rendered with chip

- **GIVEN** S is assigned to P with status `on_break` and `paused_until=2026-05-15`
- **WHEN** S opens home
- **THEN** P's row displays "On break until May 15, 2026" (localized)
- **AND** P appears after Green persons

### Requirement: The Pending follow-ups card SHALL show the count and the top three items.

The card MUST display the total count from `servant_pending_followups_count` and a preview of up to 3 items from the "Needs follow-up" section of the dedicated screen. A "View all" link MUST navigate to `/follow-ups`.

#### Scenario: Count badge reflects current state

- **GIVEN** S has 7 pending follow-ups
- **WHEN** S opens home
- **THEN** the badge on the Pending follow-ups card reads "7"
- **AND** the preview shows the first 3 rows

#### Scenario: Empty state when none

- **GIVEN** S has zero pending follow-ups
- **WHEN** S opens home
- **THEN** the card shows the localized empty state "No follow-ups pending"

### Requirement: Recent newcomers SHALL show registrations from the last 30 days across all servants.

The Recent newcomers section MUST render persons whose `registered_at` is within the last 30 days, regardless of `assigned_servant`. Each row shows name, "X days ago" relative time, and a registration-type chip (Quick Add or Full).

#### Scenario: Spans all servants

- **GIVEN** newcomer N1 was registered by servant S1, N2 by S2, both in last 30 days
- **AND** any servant S signs in
- **WHEN** S opens home
- **THEN** both N1 and N2 are visible in Recent newcomers

#### Scenario: Older than 30 days excluded

- **GIVEN** N3 registered 31 days ago
- **WHEN** any servant opens home
- **THEN** N3 is not in the section

### Requirement: Pull-to-refresh SHALL refetch all sections.

A pull-to-refresh gesture MUST invalidate `servant_my_group`, `servant_pending_followups_count`, `servant_recent_newcomers`, and refetch them in parallel.

#### Scenario: Refresh updates after a state change

- **GIVEN** the home screen is displayed
- **AND** an admin has just reassigned a person to/from S in the database
- **WHEN** S pulls to refresh
- **THEN** the My Group list updates to reflect the new assignment
