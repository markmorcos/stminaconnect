# auth — Spec Delta

## MODIFIED Requirements

### Requirement: Each authenticated user SHALL have a corresponding `servants` row.

The `servants` table MUST be the source of truth for display name and role. After successful auth, the app MUST fetch the servant row via `get_my_servant()`. If no matching row exists, the user SHALL be signed out with an error.

This change extends the requirement: if `servants.deactivated_at IS NOT NULL`, `get_my_servant()` MUST return null and the auth flow MUST sign the user out. Active servants (where `deactivated_at IS NULL`) are unaffected.

#### Scenario: Active servant authentication unchanged

- **GIVEN** an active servant (deactivated_at IS NULL)
- **WHEN** the user signs in
- **THEN** the home/dashboard route loads as before
- **AND** `get_my_servant()` returns the populated row

#### Scenario: Deactivated servant signed out

- **GIVEN** a servant whose `deactivated_at` has been set
- **WHEN** the auth flow fetches the servant row
- **THEN** `get_my_servant()` returns null
- **AND** the user is signed out
- **AND** the sign-in screen displays "Account not configured. Contact your admin."

#### Scenario: Active session of newly-deactivated servant ends on next refresh

- **GIVEN** servant S has an active session
- **WHEN** an admin deactivates S
- **AND** S's app refreshes the session (foreground transition or RPC error)
- **THEN** `get_my_servant()` returns null
- **AND** the auth store calls signOut
