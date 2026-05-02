# auth Specification

## Purpose

The auth capability gates every authenticated surface in the app. Servants are the only logged-in users — there is no public sign-up, no member auth, and no native-module-dependent provider in v1. A single sign-in flow is supported: the user enters their email, receives a magic-link email from Supabase Auth, and taps the link, which routes through `stminaconnect://auth/callback` and exchanges the PKCE code for a session. Email/password sign-in and 6-digit OTP-typing are not supported by the app, and email/password is disabled at the Supabase project level. Sessions persist across app restarts. A `servants` row joined on `auth.users.id` is the canonical identity record (display name, role); RLS keeps each servant's row visible only to themselves and to admins.

## Requirements

### Requirement: The system SHALL authenticate servants via Supabase Auth using an emailed magic link as the sole sign-in path.

Servants are the only authenticated users. There is no public sign-up. A single sign-in flow is supported: the user enters their email, receives a magic-link email from Supabase Auth, and taps the link. The link uses the custom `stminaconnect://` scheme and routes to `app/auth/callback.tsx`, which exchanges the PKCE code for a session. Email/password sign-in is NOT supported by the app and SHALL be disabled at the Supabase project level (Authentication → Providers → Email: Password disabled). The 6-digit OTP code that Supabase embeds in the same email is also not consumed by the app. Sessions persist across app restarts. The system SHALL NOT integrate Google Sign-In, Apple Sign-In, or any other native-module-dependent provider in v1.

#### Scenario: Magic-link sign-in completes via `stminaconnect://`

- **GIVEN** a dev-client / preview / production build with the `stminaconnect://` scheme registered
- **AND** a servant row exists for `volunteer@stminaconnect.com`
- **WHEN** the user enters that email and taps "Send magic link"
- **THEN** `signInWithOtp` is invoked which stores a PKCE `code_verifier` in `secureAuthStorage`
- **AND** the screen shows a "check your email" confirmation, surfacing the email address
- **AND** the user taps the magic link in the email on the same device, in the same app install
- **AND** the OS opens the app via `stminaconnect://auth/callback?code=…`
- **AND** the callback route exchanges the code for a session via `exchangeCodeForSession`
- **AND** the auth store's `session` becomes non-null and `servant` becomes the joined row
- **AND** the user lands on the authenticated home screen

#### Scenario: Send-link failure surfaces a clear error

- **GIVEN** a malformed email or a Supabase Auth error response (e.g. rate limited, invalid recipient)
- **WHEN** the user taps "Send magic link"
- **THEN** no transition to the "check your inbox" state occurs
- **AND** the screen displays an error message via Snackbar
- **AND** the form remains usable for retry

#### Scenario: Magic-link callback fails fast when the code verifier is missing

- **GIVEN** the user opened a magic link without a matching `code_verifier` (e.g. the app was reinstalled, the link was generated outside the app via the Supabase dashboard, or the link was tapped on a different device)
- **WHEN** `app/auth/callback.tsx` calls `exchangeCodeForSession`
- **THEN** the call is bounded by a 10-second timeout
- **AND** within 10 seconds the callback resolves to an error state
- **AND** the user is redirected to `/sign-in`
- **AND** the sign-in screen is usable for re-requesting the link

#### Scenario: Sign-up is not available

- **WHEN** the sign-in screen is rendered
- **THEN** there is no "Sign up" / "Create account" affordance visible
- **AND** the Supabase project has email/password sign-up disabled at the project level

#### Scenario: Password sign-in is not exposed

- **WHEN** the sign-in screen is rendered in any state
- **THEN** there is no password input field
- **AND** there is no "Sign in with password" affordance, mode toggle, or hidden path
- **AND** the auth store does NOT export a `signIn(email, password)` action

#### Scenario: 6-digit OTP code input is not exposed

- **WHEN** the sign-in screen is rendered in any state
- **THEN** there is no input field accepting a 6-digit code
- **AND** there is no UI affordance to "verify code" or similar
- **AND** the auth store does NOT export a `verifyEmailOtp` action

#### Scenario: Email/password provider is disabled at the Supabase project level

- **GIVEN** the Supabase project (preview or production)
- **WHEN** an Authentication → Providers admin view is consulted
- **THEN** the Email provider's "Enable Email password" toggle is off
- **AND** a direct `POST /auth/v1/token?grant_type=password` request returns an error rather than a session

### Requirement: Sessions SHALL persist across app restarts.

The Supabase JS client MUST be configured with `persistSession: true`. From this change forward, auth tokens MUST persist via `expo-secure-store` (not AsyncStorage). On first boot post-deploy, a one-way migration MUST copy any existing session from AsyncStorage to SecureStore and clear the AsyncStorage entry. The Supabase client MUST be configured with the SecureStore-backed storage adapter.

#### Scenario: Existing AsyncStorage session migrates on boot

- **GIVEN** a returning user whose session is stored in AsyncStorage from a prior version
- **WHEN** the app boots after upgrade
- **THEN** SecureStore contains the session
- **AND** AsyncStorage no longer contains the session
- **AND** the user is signed in without re-entering credentials

#### Scenario: Subsequent boots skip the migration

- **GIVEN** SecureStore already has the session
- **WHEN** the app boots
- **THEN** the migration code path runs but performs no work
- **AND** boot completes within normal time

#### Scenario: Fresh install uses SecureStore directly

- **GIVEN** a fresh install on a device with no prior data
- **WHEN** the user signs in
- **THEN** the session is written directly to SecureStore
- **AND** AsyncStorage is never written for auth

### Requirement: Authenticated routes SHALL be guarded.

Routes under `app/(app)/*` MUST be reachable only with a non-null `session`. Routes under `app/(auth)/*` MUST be reachable only when `session` is null. From this change forward, route guarding MUST also enforce consent: after session and servant-row checks, the authenticated layout MUST verify `get_my_latest_consent()` returns a row whose `policy_version` and `terms_version` match the currently-published versions. If the check fails, the user MUST be redirected to `app/(onboarding)/consent.tsx` instead of any `app/(app)/*` route.

#### Scenario: Unauthenticated user is redirected from protected route

- **GIVEN** no session is present
- **WHEN** the user navigates to any route under `app/(app)/*`
- **THEN** they are redirected to `app/(auth)/sign-in.tsx`
- **AND** no protected screen is briefly rendered before the redirect

#### Scenario: Authenticated user without current consent is redirected to consent

- **GIVEN** a signed-in user with a valid `servants` row
- **AND** no consent acceptance, OR an acceptance whose versions do not match the current published versions
- **WHEN** the user attempts to navigate to any `app/(app)/*` route
- **THEN** they are redirected to `app/(onboarding)/consent.tsx`
- **AND** no other authenticated screen renders

#### Scenario: Authenticated user with current consent reaches home

- **GIVEN** a signed-in user with a current consent acceptance matching published versions
- **WHEN** the user navigates to `app/(app)/index.tsx` or `app/(app)/admin/dashboard.tsx`
- **THEN** the destination renders normally

#### Scenario: Authenticated user is redirected away from sign-in

- **GIVEN** a valid session is present
- **WHEN** the user navigates to `app/(auth)/sign-in.tsx`
- **THEN** they are redirected to `app/(app)/index.tsx`

### Requirement: Each authenticated user SHALL have a corresponding active `servants` row.

The `servants` table is the source of truth for display name and role. After successful auth, the app SHALL fetch the servant row via the `get_my_servant()` RPC. The RPC MUST return null when no matching row exists OR when `servants.deactivated_at IS NOT NULL`. In either null case, the user is signed out with an error message.

#### Scenario: Auth user with no servants row is rejected

- **GIVEN** a user `orphan@example.com` exists in `auth.users` but has no row in `servants`
- **WHEN** they sign in successfully via Supabase Auth
- **THEN** the app fetches via `get_my_servant()` and receives null
- **AND** the auth store calls `signOut`
- **AND** the sign-in screen displays "Account not configured. Contact your admin."

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

`useAuth()` MUST return `{ session, servant, isLoading, error, signInWithMagicLink, signOut, setServant }`. The auth store separately exposes `isHydrated` (true once the initial session check has settled), which layouts use to gate route redirects so that in-flight actions do not unmount the active screen. The `servant.role` field is the canonical role identifier; later phases SHALL consume it to gate admin-only screens. No admin-only screens exist in this phase.

#### Scenario: Auth store exposes role on a signed-in admin

- **GIVEN** a signed-in admin
- **WHEN** a component calls `useAuth().servant.role`
- **THEN** it returns the string `'admin'`

### Requirement: An authenticated servant SHALL be able to update their own display name from an in-app account screen.

The app MUST surface an Account screen at `/settings/account` reachable from the home overflow menu. The screen MUST present the servant's current `display_name` in an editable input and a Save button. Submitting MUST call the `update_my_servant(display_name)` RPC, which MUST validate non-empty and length ≤ 100 characters and bump `updated_at`. After a successful save the auth store's `servant.display_name` SHALL reflect the value returned by the RPC. The screen MUST be reachable only by an authenticated servant.

#### Scenario: Servant updates display name successfully

- **GIVEN** servant S is signed in with `display_name='Old Name'`
- **WHEN** S opens `/settings/account`, replaces the field with `'New Name'`, and taps Save
- **THEN** `update_my_servant('New Name')` is called
- **AND** the auth store's `servant.display_name` is `'New Name'`
- **AND** the home greeting reflects `'New Name'` after navigating back

#### Scenario: Display name validation blocks empty values

- **GIVEN** servant S on `/settings/account`
- **WHEN** S clears the display-name field and taps Save
- **THEN** the form surfaces an inline localized error
- **AND** no RPC is called

#### Scenario: Display name length is enforced server-side

- **GIVEN** servant S on `/settings/account`
- **WHEN** S submits a 200-character `display_name`
- **THEN** `update_my_servant` rejects with an error
- **AND** the screen surfaces a localized error

### Requirement: Email SHALL be displayed as read-only on the account screen.

The Account screen MUST render the servant's email in a read-only `TextInput` with `editable={false}` and a localized helper line directing the user to contact an admin for changes. There MUST NOT be a "Change email" button or modal. The application MUST NOT call `supabase.auth.updateUser({ email })` from any client code path in v1.

#### Scenario: Email is not editable

- **GIVEN** servant S on `/settings/account`
- **WHEN** S taps the email field
- **THEN** no editing affordance appears (keyboard does not open, no cursor)
- **AND** a localized helper "Contact an admin to change" is visible below the field

### Requirement: An admin RPC SHALL allow updating another servant's display name.

The system MUST expose `update_servant(servant_id uuid, payload jsonb)` as a `SECURITY DEFINER` Postgres RPC. It MUST reject non-admin callers. It MUST whitelist `display_name` only in v1 and MUST validate the same constraints as `update_my_servant` (non-empty, ≤ 100 chars). Unknown payload keys MUST be ignored without error so the contract is forward-compatible. The function MUST bump `updated_at` and return the updated row.

#### Scenario: Admin updates another servant's display name

- **GIVEN** admin A and servant S2 with `display_name='Volunteer Two'`
- **WHEN** A calls `update_servant(S2.id, '{"display_name": "S. Two"}'::jsonb)`
- **THEN** the RPC succeeds
- **AND** S2's `display_name` is `'S. Two'`
- **AND** `updated_at` is recent

#### Scenario: Non-admin caller is rejected

- **GIVEN** servant S1 (non-admin) and servant S2
- **WHEN** S1 calls `update_servant(S2.id, '{"display_name": "anything"}'::jsonb)`
- **THEN** the RPC raises an `'admin only'` error

#### Scenario: Unknown payload keys are ignored

- **GIVEN** admin A
- **WHEN** A calls `update_servant(S2.id, '{"display_name": "Ok", "role": "admin"}'::jsonb)`
- **THEN** `display_name` is updated
- **AND** `role` is unchanged
- **AND** the call returns success
