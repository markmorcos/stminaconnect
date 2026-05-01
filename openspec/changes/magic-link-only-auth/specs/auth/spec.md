## MODIFIED Requirements

### Requirement: The system SHALL authenticate servants via Supabase Auth using an emailed magic link as the sole sign-in path.

Servants are the only authenticated users. There is no public sign-up. A single sign-in flow is supported: the user enters their email, receives a magic-link email from Supabase Auth, and taps the link. The link uses the custom `stminaconnect://` scheme and routes to `app/auth/callback.tsx`, which exchanges the PKCE code for a session. Email/password sign-in is NOT supported by the app and SHALL be disabled at the Supabase project level (Authentication → Providers → Email: Password disabled). The 6-digit OTP code that Supabase embeds in the same email is also not consumed by the app. Sessions persist across app restarts. The system SHALL NOT integrate Google Sign-In, Apple Sign-In, or any other native-module-dependent provider in v1.

#### Scenario: Magic-link sign-in completes via `stminaconnect://`

- **GIVEN** a dev-client / preview / production build with the `stminaconnect://` scheme registered
- **AND** a servant row exists for `volunteer@stmina.de`
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
