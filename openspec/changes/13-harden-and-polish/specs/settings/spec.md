## ADDED Requirements

### Requirement: Help / Contact section

The Settings tab SHALL include a Help section showing the church's contact phone and email (from app config), a link to church info, and a "Report a problem" mailto link including the app version and device model pre-filled.

#### Scenario: Contact info visible

- **GIVEN** a user on Settings
- **WHEN** they open the Help section
- **THEN** church phone and email are shown
- **AND** tapping phone opens the OS dialer; tapping email opens the mail composer pre-filled

#### Scenario: Report a problem

- **GIVEN** the user taps "Report a problem"
- **WHEN** the mail client opens
- **THEN** the subject includes app version + build
- **AND** the body includes device model and OS version

### Requirement: Export my device data

Settings SHALL include a "Export my device data" action that produces a JSON file containing all local-DB contents for the current user and shares it via OS share sheet. This is a debugging affordance; no server data is fetched.

#### Scenario: Export

- **GIVEN** a servant with local data
- **WHEN** they tap Export my device data
- **THEN** a JSON file is created and the share sheet opens
- **AND** the file contains only data from local SQLite, not fresh server reads
