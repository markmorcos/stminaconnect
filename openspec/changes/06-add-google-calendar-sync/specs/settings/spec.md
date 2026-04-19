## ADDED Requirements

### Requirement: Counted-event patterns admin section

The Settings tab SHALL show a "Counted Events" section visible ONLY to admins, where they can list, add, edit, and archive title patterns that determine which events count toward absence detection.

#### Scenario: Admin adds a pattern

- **GIVEN** an authenticated admin on Settings → Counted Events
- **WHEN** they add pattern `friday vespers`
- **THEN** the pattern appears in the list
- **AND** the preview panel updates to show all events in the next 30 days whose title matches any pattern

#### Scenario: Admin archives a pattern

- **GIVEN** an authenticated admin
- **WHEN** they tap archive on a pattern and confirm
- **THEN** the pattern is removed from the active list
- **AND** the preview panel recomputes

#### Scenario: Servant does not see the section

- **GIVEN** an authenticated servant
- **WHEN** they open the Settings tab
- **THEN** there is no "Counted Events" section

### Requirement: Manual sync now (admin)

The "Counted Events" section SHALL include a "Sync now" action (admin only) that invokes the `calendar-sync` Edge Function on demand and reports success or failure.

#### Scenario: Sync now succeeds

- **GIVEN** an admin taps "Sync now"
- **WHEN** the Edge Function runs successfully
- **THEN** a toast confirms how many events were synced
- **AND** the preview panel reflects the latest data

#### Scenario: Sync now fails

- **GIVEN** the Google service account credentials are invalid
- **WHEN** admin taps "Sync now"
- **THEN** the toast reports the failure (with a non-technical message)
- **AND** a retry action is offered
