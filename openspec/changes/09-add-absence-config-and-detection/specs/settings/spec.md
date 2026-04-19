## ADDED Requirements

### Requirement: Absence Configuration admin section

The Settings tab SHALL include an "Absence Configuration" section visible only to admins, allowing them to edit the default threshold, per-priority threshold overrides, the "also notify admins" toggle, and trigger "Re-detect now".

#### Scenario: Admin edits default threshold

- **GIVEN** an admin on Absence Configuration
- **WHEN** they change default threshold from 3 to 4 and tap Save
- **THEN** `absence_config.default_threshold = 4`
- **AND** a confirmation toast appears

#### Scenario: Admin edits per-priority override

- **GIVEN** an admin sets `high = 2` and `medium` left as default
- **WHEN** they Save
- **THEN** `alert_priority_thresholds.high = 2` and `medium` inherits `default_threshold`

#### Scenario: Admin toggles admin notifications

- **GIVEN** admin toggles "Also notify admins" off
- **WHEN** they Save
- **THEN** `absence_config.admin_gets_alerts = false`
- **AND** subsequent alerts do NOT notify admins (notification behavior ships in `add-push-and-followups`)

#### Scenario: Re-detect now

- **WHEN** admin taps Re-detect now
- **THEN** the `detect-absences` Edge Function is invoked and the toast reports `N new alerts`

#### Scenario: Servant does not see the section

- **GIVEN** a servant on Settings
- **THEN** Absence Configuration section is not rendered
