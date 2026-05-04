## ADDED Requirements

### Requirement: The system SHALL provide a server-issued magic-link bypass for a single configured reviewer email so app-store reviewers can sign in on a clean device without inbox access.

The bypass exists exclusively to satisfy Google Play and Apple App Store review requirements that prohibit email/SMS/OAuth dependencies for reviewer credentials. It SHALL operate as follows:

- A Supabase Edge Function `review-login` SHALL be deployed and accessible via the standard `supabase.functions.invoke` channel.
- The function SHALL read the bypass identity from the `REVIEW_BYPASS_EMAIL` Edge Function secret. The bypass email SHALL NOT appear in `app.json`, `eas.json`, any `EXPO_PUBLIC_*` environment variable, the JS bundle, or any committed source file.
- The function SHALL accept `{ email }` and SHALL return `{ link: string | null }`.
- When the supplied email matches `REVIEW_BYPASS_EMAIL` (case-insensitive, trimmed), the function SHALL call `auth.admin.generateLink({ type: 'magiclink', email })` using the project's service role and return `properties.action_link` as `link`.
- When the supplied email does NOT match, the function SHALL return `{ link: null }` and SHALL NOT call `generateLink` or any other authenticated Supabase Auth admin API.
- The function SHALL log every invocation that produces a non-null link (timestamp, IP, user-agent) for audit. Non-matching invocations SHALL log only the IP and a "no-match" outcome — never the supplied email.
- The reviewer auth user (matching `REVIEW_BYPASS_EMAIL`) and a corresponding `servants` row SHALL be provisioned once per environment so the generated magic link resolves to a real session and `fetchMyServant()` does not orphan-sign-out the reviewer.
- The bypass email's local-part SHALL be non-guessable (random 8+ hex chars) so response-shape enumeration is computationally infeasible.

#### Scenario: Reviewer email returns a fresh magic link

- **GIVEN** the `REVIEW_BYPASS_EMAIL` secret is set in the production Supabase project
- **AND** a matching `auth.users` row and `servants` row exist for that email
- **WHEN** the sign-in screen calls `review-login` with the configured reviewer email
- **THEN** the function calls `auth.admin.generateLink({ type: 'magiclink', email })`
- **AND** the function returns `{ link: <action_link URL> }`
- **AND** the link, when opened, redirects to `stminaconnect://auth/callback` with valid tokens in the URL fragment
- **AND** `app/auth/callback.tsx` calls `setSession`, the auth store populates `session` and `servant`, and the user lands on the home screen

#### Scenario: Non-matching email returns null and triggers no admin calls

- **GIVEN** the `REVIEW_BYPASS_EMAIL` secret is set
- **WHEN** the sign-in screen calls `review-login` with any email other than the configured reviewer email
- **THEN** the function returns `{ link: null }`
- **AND** `auth.admin.generateLink` is NOT called
- **AND** the response shape is identical regardless of whether the supplied email exists in `auth.users`

#### Scenario: Bypass email never appears in the client bundle

- **WHEN** a reviewer greps the production JS bundle, `app.json`, `eas.json`, or any `EXPO_PUBLIC_*` env value for the bypass email
- **THEN** no occurrence is found
- **AND** the only place the bypass email exists outside Supabase secrets is the store-submission runbook (which is not shipped)

### Requirement: The sign-in client SHALL route every sign-in attempt through `review-login` first and surface a returned link via a dialog without altering the production flow for real users.

The `signInWithMagicLink` action in `src/state/authStore.ts` SHALL invoke `review-login` before any call to `signInWithOtp`. The flow SHALL be:

1. Call `supabase.functions.invoke('review-login', { body: { email } })`.
2. If the response contains a non-null `link`, present a dialog on the sign-in screen with that link and a "Sign in" affordance, set loading state false, and return without calling `signInWithOtp`.
3. If the response contains a null `link`, OR if the invoke throws, OR if the invoke times out, fall through to today's `supabase.auth.signInWithOtp` call with unchanged parameters and unchanged error mapping.

The dialog's "Sign in" affordance SHALL call `Linking.openURL(link)`. The existing `app/auth/callback.tsx` handler SHALL handle the resulting deeplink without modification.

#### Scenario: Real user sign-in is unchanged on success

- **GIVEN** a normal servant types their email and taps "Send magic link"
- **AND** the email does NOT match `REVIEW_BYPASS_EMAIL`
- **WHEN** the sign-in action runs
- **THEN** `review-login` returns `{ link: null }`
- **AND** `supabase.auth.signInWithOtp` is called with the same parameters used today
- **AND** the user sees the existing "check your email" confirmation
- **AND** subsequent magic-link tap behaviour is unchanged from `auth/spec.md`

#### Scenario: Edge Function failure degrades gracefully to the existing flow

- **GIVEN** the `review-login` function is unavailable, returns a 5xx, throws, or times out
- **WHEN** any user attempts to sign in
- **THEN** the auth store catches the error
- **AND** falls through to `supabase.auth.signInWithOtp` with unchanged parameters
- **AND** real users complete sign-in normally
- **AND** the only behaviour lost is the reviewer bypass for that interval

#### Scenario: Reviewer sees the sign-in dialog instead of an email confirmation

- **GIVEN** the reviewer types `REVIEW_BYPASS_EMAIL` on a clean Play test device
- **WHEN** they tap "Send magic link"
- **THEN** the screen does NOT show "check your email"
- **AND** a dialog appears with a "Sign in" button
- **AND** tapping "Sign in" opens the link via `Linking.openURL`
- **AND** the OS routes the redirect back to `stminaconnect://auth/callback`
- **AND** the existing callback handler completes the session
- **AND** the reviewer lands on the authenticated home screen
