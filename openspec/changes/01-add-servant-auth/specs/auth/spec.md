## ADDED Requirements

### Requirement: Invitation-only account creation

The system SHALL NOT allow self-signup. New accounts SHALL be created only via an admin-initiated invitation that sends a magic-link email to the invitee.

#### Scenario: Admin invites a new servant

- **GIVEN** an authenticated admin
- **WHEN** they submit an invite for `maria@example.com` with role `servant`
- **THEN** the `invite-user` Edge Function verifies the admin's JWT, calls `auth.admin.inviteUserByEmail`, and returns success
- **AND** Maria receives an email with a magic link
- **AND** when Maria taps the link, a new `auth.users` row is created, the `handle_new_user` trigger inserts a `profiles` row with `role = 'servant'`, `active = true`, and `display_name = "Maria"` (from invite payload)

#### Scenario: Non-admin cannot invite

- **GIVEN** an authenticated servant
- **WHEN** they call the `invite-user` Edge Function with any payload
- **THEN** the function returns `403 forbidden`
- **AND** no user is created

#### Scenario: Self-signup is blocked

- **GIVEN** an unauthenticated person with the app installed
- **WHEN** they attempt to sign up (there is no UI to do so, but they try via the Supabase Auth endpoint directly)
- **THEN** Supabase Auth rejects the request because signup is disabled in project config

### Requirement: Session persistence

The system SHALL persist authenticated sessions across app restarts, using secure on-device storage, until the user signs out or is deactivated.

#### Scenario: App reopen retains session

- **GIVEN** a servant who signed in on their device earlier today
- **WHEN** they close the app and reopen it
- **THEN** the app loads directly to the authenticated home without a login screen
- **AND** `auth_context` returns their role and display name

#### Scenario: Tokens are stored securely

- **GIVEN** the Supabase client is configured
- **WHEN** a session is established
- **THEN** the access and refresh tokens are written via `expo-secure-store`, not plain `AsyncStorage`

### Requirement: Role-aware session context

The app SHALL determine the authenticated user's role via the `auth_context()` RPC immediately after sign-in and on every session refresh, and SHALL gate navigation accordingly.

#### Scenario: Admin sees authenticated home

- **GIVEN** an authenticated admin
- **WHEN** they open the app
- **THEN** the session store reports `role = admin`
- **AND** the home tab renders with a welcome message

#### Scenario: Servant sees authenticated home

- **GIVEN** an authenticated servant
- **WHEN** they open the app
- **THEN** the session store reports `role = servant`
- **AND** the home tab renders with a welcome message

#### Scenario: Deactivated user is blocked

- **GIVEN** a user whose `profiles.active` is false
- **WHEN** they attempt to access the app (fresh sign-in or existing session refresh)
- **THEN** the app shows "Your account has been deactivated. Contact an admin." and does not render any protected screen
- **AND** the local session is cleared

### Requirement: Admin can deactivate users

Admins SHALL be able to deactivate any user via the `deactivate_user(target uuid)` RPC, which sets `profiles.active = false` AND revokes all refresh tokens so the user is forcibly signed out on their next token refresh.

#### Scenario: Admin deactivates a servant

- **GIVEN** an authenticated admin and an active servant user
- **WHEN** the admin calls `deactivate_user(servant_id)`
- **THEN** the RPC returns success
- **AND** `profiles.active` for the servant becomes `false`
- **AND** all of the servant's refresh tokens are revoked
- **AND** on the servant's device, the next auth refresh fails and the app shows the deactivated-user screen

#### Scenario: Non-admin cannot deactivate

- **GIVEN** an authenticated servant
- **WHEN** they call `deactivate_user(any_user_id)`
- **THEN** the RPC raises an exception denoting insufficient privileges

### Requirement: Logout clears local state

The sign-out action SHALL clear the Supabase session, remove tokens from secure storage, and reset any in-memory Zustand state so no user data remains on the device.

#### Scenario: User signs out

- **GIVEN** an authenticated user
- **WHEN** they tap "Sign out" on the home screen
- **THEN** tokens are cleared from `expo-secure-store`
- **AND** the session store resets to `unauthenticated`
- **AND** the app navigates to the login screen

### Requirement: Profiles table RLS enforces role-based access

RLS policies on `profiles` SHALL ensure a user can read and update only their own row (excluding privileged fields `role` and `active`), and that admins can read/update any row.

#### Scenario: Servant cannot read other profiles

- **GIVEN** servant A is authenticated
- **WHEN** they query `SELECT * FROM profiles WHERE id = <servant B id>`
- **THEN** zero rows are returned

#### Scenario: Servant cannot elevate themselves

- **GIVEN** servant A is authenticated
- **WHEN** they attempt `UPDATE profiles SET role = 'admin' WHERE id = auth.uid()`
- **THEN** the update fails or zero rows are affected

#### Scenario: Admin can read any profile

- **GIVEN** an authenticated admin
- **WHEN** they query `SELECT * FROM profiles`
- **THEN** all profile rows are returned
