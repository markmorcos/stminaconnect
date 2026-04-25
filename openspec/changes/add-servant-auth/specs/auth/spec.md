# auth — Spec Delta

## ADDED Requirements

### Requirement: The system SHALL authenticate servants via Supabase Auth using email/password or magic link.

Servants are the only authenticated users. There is no public sign-up. Two flows are supported: email/password (default) and magic link (alternate). Sessions persist across app restarts. The system SHALL NOT integrate Google Sign-In, Apple Sign-In, or any other native-module-dependent provider in v1.

#### Scenario: Successful email/password sign-in

- **GIVEN** a `servants` row exists for `priest@stmina.de` with role `admin`
- **AND** the corresponding `auth.users` row has password `correctPassword!`
- **WHEN** the servant enters `priest@stmina.de` and `correctPassword!` and taps "Sign in"
- **THEN** the auth store's `session` becomes non-null
- **AND** the auth store's `servant` becomes the joined row with `role = 'admin'`
- **AND** the user is redirected to the authenticated home screen

#### Scenario: Failed sign-in surfaces a clear error

- **GIVEN** any servant row with a known password
- **WHEN** a sign-in attempt is made with the wrong password
- **THEN** no session is established
- **AND** the screen displays an error message via Paper Snackbar
- **AND** the form remains usable for retry

#### Scenario: Magic-link sign-in completes via deep link

- **GIVEN** a servant row exists for `volunteer@stmina.de`
- **WHEN** the user enters that email and taps "Send link"
- **AND** receives the email and taps the link on the device running Expo Go
- **THEN** the OS opens the Expo Go app via the configured `exp://...` redirect
- **AND** the callback route exchanges the token for a session
- **AND** the user lands on the authenticated home screen

#### Scenario: Sign-up is not available

- **WHEN** the sign-in screen is rendered
- **THEN** there is no "Sign up" / "Create account" affordance visible
- **AND** the Supabase project has email/password sign-up disabled at the project level

### Requirement: Sessions SHALL persist across app restarts.

The Supabase JS client SHALL be configured with `persistSession: true` using AsyncStorage. Closing and reopening the app while online MUST NOT require re-entering credentials, provided the refresh token is still valid.

#### Scenario: Reopening the app preserves the session

- **GIVEN** a servant has signed in and the session is valid
- **WHEN** the app is killed and reopened in Expo Go
- **THEN** the auth store's `session` is non-null without any user input
- **AND** the home screen renders directly

#### Scenario: Expired refresh token forces re-auth

- **GIVEN** a refresh token has expired (e.g. >30 days idle)
- **WHEN** the app reopens and tries to refresh
- **THEN** the user is redirected to the sign-in screen
- **AND** stored auth data in AsyncStorage is cleared

### Requirement: Authenticated routes SHALL be guarded.

Routes under `app/(app)/*` MUST be reachable only with a non-null `session`. Routes under `app/(auth)/*` MUST be reachable only when `session` is null. Redirects happen at layout level so deep links cannot bypass the guard.

#### Scenario: Unauthenticated user is redirected from protected route

- **GIVEN** no session is present
- **WHEN** the user navigates to any route under `app/(app)/*` (e.g. via deep link)
- **THEN** they are redirected to `app/(auth)/sign-in.tsx`
- **AND** no protected screen is briefly rendered before the redirect

#### Scenario: Authenticated user is redirected away from sign-in

- **GIVEN** a valid session is present
- **WHEN** the user navigates to `app/(auth)/sign-in.tsx`
- **THEN** they are redirected to `app/(app)/index.tsx`

### Requirement: Each authenticated user SHALL have a corresponding `servants` row.

The `servants` table is the source of truth for display name and role. After successful auth, the app SHALL fetch the servant row via the `get_my_servant()` RPC. If no matching row exists, the user is signed out with an error message.

#### Scenario: Auth user with no servants row is rejected

- **GIVEN** a user `orphan@example.com` exists in `auth.users` but has no row in `servants`
- **WHEN** they sign in successfully via Supabase Auth
- **THEN** the app fetches via `get_my_servant()` and receives null
- **AND** the auth store calls `signOut`
- **AND** the sign-in screen displays "Account not configured. Contact your admin."

### Requirement: The `servants` table SHALL enforce row-level security from creation.

RLS MUST be enabled on `servants` before any row is inserted. Policies SHALL allow:
- A servant to read their own row.
- An admin (a servant with `role = 'admin'`) to read all rows.

Writes (INSERT/UPDATE/DELETE) on `servants` are NOT allowed from the client in this phase — admins manage rows via the Supabase Dashboard. Phase 13 introduces an admin RPC for in-app management.

#### Scenario: Servant cannot read another servant's row

- **GIVEN** servants A and B exist; A is signed in (role `servant`)
- **WHEN** A queries the `servants` table for B's row
- **THEN** the query returns zero rows (RLS-filtered)

#### Scenario: Admin can read all servants

- **GIVEN** servant X exists with role `admin`; multiple other servants also exist
- **WHEN** X queries the full `servants` table
- **THEN** all rows are returned

#### Scenario: No servant can write to `servants` from the client

- **GIVEN** any signed-in servant (admin or not)
- **WHEN** they attempt INSERT, UPDATE, or DELETE on `servants` via the client
- **THEN** the operation is rejected by RLS with an error

### Requirement: Sign-out SHALL clear the session and return the user to the sign-in screen.

Tapping "Sign out" from the temporary Account screen MUST clear the Supabase session, clear the auth store, and navigate to `app/(auth)/sign-in.tsx`. Pending sync work is irrelevant in this phase (no offline writes exist yet); the dialog comes in phase 10.

#### Scenario: Sign-out clears state and navigates

- **GIVEN** a signed-in servant on the home screen
- **WHEN** they tap "Sign out"
- **THEN** the auth store's `session` and `servant` become null
- **AND** AsyncStorage no longer contains the Supabase session token
- **AND** the user lands on the sign-in screen

### Requirement: The auth store SHALL expose role information for downstream features.

`useAuth()` MUST return `{ session, servant, isLoading, error, signIn, signInWithMagicLink, signOut }`. The `servant.role` field is the canonical role identifier; later phases SHALL consume it to gate admin-only screens. No admin-only screens exist in this phase.

#### Scenario: Auth store exposes role on a signed-in admin

- **GIVEN** a signed-in admin
- **WHEN** a component calls `useAuth().servant.role`
- **THEN** it returns the string `'admin'`
