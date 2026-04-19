## ADDED Requirements

### Requirement: Settings tab exists

The authenticated tab bar SHALL include a Settings tab accessible to all roles. The Settings screen SHALL have at minimum a Language section and an About section in this change (more sections added by later changes).

#### Scenario: Settings tab accessible

- **GIVEN** an authenticated user
- **WHEN** they look at the tab bar
- **THEN** a Settings tab is present
- **AND** tapping it opens a screen with Language and About sections

### Requirement: About section shows app version

The About section SHALL display the app's version (from Expo config) and a short attribution to St. Mina Coptic Orthodox Church Munich.

#### Scenario: Version displayed

- **GIVEN** the user opens Settings → About
- **WHEN** the section renders
- **THEN** the app's semantic version and build number are shown
- **AND** attribution text is shown, localized
