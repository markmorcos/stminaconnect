## MODIFIED Requirements

### Requirement: Deactivated user is blocked

The "Your account has been deactivated" screen SHALL show the church contact phone + email and a "Request reactivation" button that opens a pre-filled email to admin(s). The screen SHALL be localized.

#### Scenario: Deactivated user sees help

- **GIVEN** a user whose account is deactivated
- **WHEN** they attempt to use the app
- **THEN** the deactivated screen displays localized text, contact info, and a "Request reactivation" button
- **AND** tapping the button opens a mail composer with `To:` the admin email and a pre-filled body mentioning the user's email
