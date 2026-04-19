## ADDED Requirements

### Requirement: Servant home layout

The Home tab for users with `role = 'servant'` SHALL render, in this order: a localized greeting, a Quick Add CTA, a Pending Follow-Ups card, a My Group list with sort control, and a Recent Newcomers list.

#### Scenario: Sections present

- **GIVEN** an authenticated servant
- **WHEN** they open the Home tab
- **THEN** all four sections are visible, each with correct content from the seed dataset

#### Scenario: Pending follow-ups card tap

- **GIVEN** the servant has 3 open follow-ups
- **WHEN** they tap the Pending Follow-Ups card
- **THEN** they navigate to the Follow-Ups tab

### Requirement: My Group list with health indicators

The My Group list SHALL render each assigned member with a colored health dot: green if streak < threshold − 1, yellow if streak == threshold − 1, red if streak ≥ threshold. The threshold per member is resolved from absence config by priority.

#### Scenario: Healthy member

- **GIVEN** Maria has `current_streak = 0`, priority `medium`, threshold = 3
- **WHEN** the list renders
- **THEN** Maria's row shows a green dot

#### Scenario: Imminent-alert member

- **GIVEN** a member with streak = 2, threshold = 3
- **WHEN** the list renders
- **THEN** their dot is yellow

#### Scenario: At-risk member

- **GIVEN** a member with streak = 3, threshold = 3 (has or will have an open alert)
- **THEN** their dot is red

#### Scenario: Last-attendance relative time

- **GIVEN** a member whose most recent counted attendance was 10 days ago
- **WHEN** the list renders
- **THEN** the row shows "Last attended: 10 days ago" (localized)

### Requirement: Sort controls persist

The My Group list SHALL expose sort-by: Name, Last attended, Priority. The choice SHALL be persisted across app restarts.

#### Scenario: Sort by last attended

- **GIVEN** a servant changes sort to "Last attended" (newest first)
- **WHEN** they close and reopen the app
- **THEN** My Group still renders sorted by Last attended

### Requirement: Recent Newcomers

A Recent Newcomers section SHALL list persons where `registered_by = auth.uid()` AND `registered_at >= now() - 30 days`, newest first.

#### Scenario: Newcomers list

- **GIVEN** the servant registered 2 newcomers in the last 30 days (one Quick Add, one Full)
- **WHEN** the dashboard loads
- **THEN** both appear in the Recent Newcomers section, newest first

#### Scenario: Empty state

- **WHEN** no newcomers in the last 30 days
- **THEN** the section shows an empty state "No recent newcomers."

### Requirement: No performance surveillance

The servant dashboard SHALL NOT display metrics that could be used to judge individual performance (e.g., follow-ups completed per week, response rates). The dashboard focuses on the member-care surface, not the servant's productivity.

#### Scenario: No performance metrics

- **WHEN** the servant loads the dashboard
- **THEN** no counter of their own actions (other than the neutral open-follow-ups count) is shown
- **AND** no comparative ranking against other servants exists anywhere in the UI
