## ADDED Requirements

### Requirement: Role-aware home screen

The Home tab SHALL render a dedicated admin dashboard for users with `role = 'admin'`; users with `role = 'servant'` SHALL continue to see the servant-focused home (established in earlier changes).

#### Scenario: Admin home renders dashboard

- **GIVEN** an authenticated admin
- **WHEN** they open the Home tab
- **THEN** the admin dashboard layout renders (overview cards, charts, at-risk list, funnel, region breakdown)

#### Scenario: Servant home unchanged

- **GIVEN** an authenticated servant
- **WHEN** they open the Home tab
- **THEN** they see the servant home (Quick Add button + their group + follow-ups), not the admin dashboard

### Requirement: Overview cards

The dashboard SHALL show at-a-glance counts: total members, new this month, active, inactive, open alerts, open follow-ups, on-break.

#### Scenario: Overview correct on seed data

- **GIVEN** the seeded dataset (20 persons, some new, some inactive)
- **WHEN** the admin loads the dashboard
- **THEN** each card's count matches the hand-computed value from `dashboard_overview()`

### Requirement: Attendance trend chart

A line chart SHALL show total attended-persons per week for counted events over the last 8–12 weeks (default 10), with localized date labels on the x-axis.

#### Scenario: 10-week window

- **GIVEN** attendance data across 12 weeks
- **WHEN** the admin loads the dashboard
- **THEN** the chart shows the last 10 weeks
- **AND** each point's y-value equals the total distinct persons attending any counted event that week

#### Scenario: RTL chart

- **GIVEN** the app is in Arabic
- **WHEN** the chart renders
- **THEN** x-axis labels render in Arabic numerals (or locale-formatted) and read in RTL order

### Requirement: At-Risk list by servant

An At-Risk section SHALL show every open alert, grouped by the alert's `assigned_servant`. Each servant group is collapsible; each alert row shows the member's name + priority + triggered_at (relative time).

#### Scenario: List structure

- **GIVEN** 5 open alerts across 3 servants
- **WHEN** the admin loads the dashboard
- **THEN** the At-Risk section shows 3 groups, each with the servant's display_name, a count badge, and the alerts as children

#### Scenario: Tap opens follow-up

- **GIVEN** an admin viewing the At-Risk list
- **WHEN** they tap a member row
- **THEN** they are navigated to the Follow-Up form for that alert (admin can also log follow-ups)

### Requirement: Newcomer funnel

A funnel visual SHALL show over the last 90 days: count of persons registered new, count that became active, count that went inactive.

#### Scenario: Funnel computation

- **GIVEN** 10 new registrations in the last 90 days; 6 became active; 1 went inactive
- **WHEN** the admin loads the dashboard
- **THEN** the funnel shows `New: 10 → Active: 6 → Inactive: 1`

### Requirement: Region breakdown

A horizontal bar or pie chart SHALL show member counts by `region`, top 10 regions plus "Other", plus "Unspecified" for null.

#### Scenario: Region chart

- **GIVEN** members spread across 12 unique regions + some null
- **WHEN** the admin loads the dashboard
- **THEN** the chart shows 10 labeled regions, "Other" bucketing the rest, and "Unspecified" for nulls

### Requirement: Manage Servants screen

A route `/manage-servants` (admin only) SHALL list all servants with their active state and assigned-member count, and expose actions to Invite, Deactivate, and Reassign-all.

#### Scenario: Invite servant

- **GIVEN** admin on Manage Servants
- **WHEN** they tap Invite → enter email + name + role=servant → Send
- **THEN** the `invite-user` Edge Function is called
- **AND** a success toast confirms and the new servant appears in the list (inactive until first sign-in)

#### Scenario: Deactivate servant creates unassigned queue

- **GIVEN** servant A has 8 assigned members
- **WHEN** admin deactivates A
- **THEN** a confirmation dialog explains that 8 members will become unassigned
- **AND** on confirmation, A's `profiles.active = false` and the 8 members' `assigned_servant_id = null`
- **AND** the dashboard shows "8 members need reassignment" banner

#### Scenario: Reassign-all from a servant

- **GIVEN** admin taps "Reassign all" on servant A's row (who has 8 members)
- **WHEN** they pick servant B and confirm
- **THEN** all 8 members' `assigned_servant_id` becomes B's id

#### Scenario: Unassigned queue

- **GIVEN** 8 members are unassigned
- **WHEN** admin taps the banner
- **THEN** a list of unassigned members appears with bulk-reassign to a picked servant
