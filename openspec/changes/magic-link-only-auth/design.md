## Context

Today the sign-in screen offers three flows behind a "Email me a code instead" toggle:

1. **Email/password** — `signIn(email, password)` against Supabase Auth. Default.
2. **Email-with-OTP** — `signInWithOtp({ email })` triggers an email containing both a 6-digit code AND a magic link; the app routes the user into `OtpModeForm` to type the 6 digits, calling `verifyEmailOtp(email, token)` to exchange.
3. **Magic-link via deep link** — same email as (2), but the user taps the link instead of typing the digits; `app/auth/callback.tsx` handles the redirect.

With the dev-client / preview build now correctly routing `stminaconnect://auth/callback?code=…` and SDK 55 in place, flow (3) is the one users prefer. Flows (1) and (2) are residual:

- (1) introduces password management surface — forgot-password, reset-password, password rules, password-store hardening — that this app's user base (servants, no public sign-up, sessions persist) doesn't need.
- (2) duplicates (3) with extra friction; same email, but typing digits instead of one tap.

This change collapses to flow (3) only.

## Goals / Non-Goals

**Goals:**

- Sign-in screen exposes a single mode: email input + "Send magic link" button + post-submit "check your inbox" empty-state.
- Magic-link flow ends in a "check your email" empty-state; tapping the link in the email completes sign-in via `app/auth/callback.tsx`.
- Removed code (`signIn`, `verifyEmailOtp`, `PasswordModeForm`, `OtpModeForm`, locale keys, related tests) is deleted, not feature-flagged.
- Callback screen fails fast (≤10s) on missing-code-verifier scenarios instead of spinning indefinitely.
- Supabase Auth Email/Password provider disabled at project level on both preview and production environments.
- Spec scenarios reflect the new reality: one path in, two failure modes covered.

**Non-Goals:**

- No change to the Supabase email template content (still mentions a 6-digit code; the app just stops accepting it). Template editing is per-environment dashboard work, can be a follow-up.
- No change to the `invite-servant` Edge Function (uses a separate token type, doesn't touch sign-in).
- No new auth provider (Google, Apple, magic-link-via-SMS, etc.). Single-provider posture is intentional for v1.
- No "password as accessibility fallback" branch. If real users hit accessibility issues with link-tapping, reopen as a separate change.
- No automated migration of existing users with passwords. Passwords stay in the `auth.users` table inert; users sign in via email link as if the password column didn't exist.

## Decisions

### Decision: Drop email/password as well as OTP, in the same change

**Rationale:** Two flows on the chopping block at once would normally be split — but here both are reachable through the same screen, the same form-handling pattern, and the same `Mode` toggle. Splitting would mean an awkward intermediate state where the toggle exists with only "magic link" on one side, and a follow-up to remove the toggle. Bundling avoids that thrash.

The two removals also share rationale: this user base, this auth posture, has no need for either path. Sessions persist for months between sign-ins; one well-handled flow is sufficient.

**Alternatives considered:**

- Keep email/password as a "break-glass" admin path. Rejected — admins are servants too, signed in via the same screen; there's no separate admin entry point. If we ever need a break-glass, it's the dashboard ("send magic link as user"), not in-app.
- Two separate changes (`drop-otp`, `drop-password`) sequenced. Rejected — adds calendar time and an awkward intermediate UI for no gain.

### Decision: Disable Email/Password provider at the Supabase project level

**Rationale:** The client-side removal closes the door from the app, but `auth.users` rows still have a usable `encrypted_password` column. A leaked password could in principle still authenticate against `/auth/v1/token?grant_type=password`. Disabling the provider in Supabase Auth → Providers slams that door at the API layer too. Cheap, dashboard-only, repeats once per environment.

**Alternatives considered:**

- Leave the provider on, rely on client-side absence. Rejected — defense-in-depth costs nothing here.
- Strip `encrypted_password` from existing rows in a migration. Rejected — destructive without reversibility, and no value once the provider is off.

### Decision: Add a 10-second timeout in `app/auth/callback.tsx` to fail fast

**Rationale:** Today, when `exchangeCodeForSession` is invoked but the device's `secureAuthStorage` has no `code_verifier` (link tapped after reinstall, link generated server-side from the dashboard, link tapped on a different device), the call hangs and the user sits on "Signing you in…" forever. Removing both alternative flows makes this hang the only failure mode users can hit — without an alternative path the user is fully stuck.

A 10s wall-clock timeout wrapping the exchange resolves to `setStatus('error')` and redirects to `/sign-in` where the user can re-request. 10s is generous enough that a slow but successful network call still completes; short enough that a permanent hang is recoverable.

**Alternatives considered:**

- Detect the missing verifier directly by reading the SecureStore key before calling `exchangeCodeForSession`. Rejected — couples our screen to supabase-js's internal storage-key naming convention (`sb-<ref>-auth-token-code-verifier`), which has shifted across minor versions.
- Display a "still working…" message after 5s, never timeout. Rejected — leaves the user with no path out.

### Decision: Spec rewrites Requirement 1 in place rather than deprecating-and-replacing

**Rationale:** OpenSpec's modified-capability delta covers exactly this case. The requirement on `auth/spec.md:9` is reworded to drop both the password and OTP clauses and assert magic-link as the single sign-in path. Scenarios are added/removed under the same requirement. No new requirement number is introduced — readers don't need to chase a deprecation chain.

## Risks / Trade-offs

- **Risk:** A user on a device that can't open `stminaconnect://` deep links (rare OS misconfig, or a heavily customized email client that strips custom schemes) loses their only way in. → Mitigation: documented troubleshooting in `docs/dev-build.md` § 5 (uninstall/reinstall, verify the scheme is registered). Worst case, an admin generates a fresh magic link from the dashboard for them.
- **Risk:** Email deliverability becomes a single point of failure. If SMTP breaks or rate-limits hit, no one can sign in until it's fixed. → Mitigation: monitor delivery; add a non-Supabase SMTP (Resend / Postmark) before user count grows. Sessions persist for long stretches, so transient email outages don't lock out signed-in users — only new sessions.
- **Trade-off:** The Supabase email template still mentions the 6-digit code, which the app no longer accepts. Users who try typing the digits anywhere see no input field — minor UX confusion. The follow-up to template a link-only email is filed as an open question rather than a blocker.
- **Trade-off:** Existing users with valid passwords lose that access path. Their first sign-in post-deploy goes via magic link. No data loss (sessions and `servants` rows are unaffected); just one extra "open your email" step on the first sign-in.

## Open Questions

- Should we customize the Supabase email template to remove the 6-digit code section, since the app no longer accepts it? Punted — template editing is per-project (preview + production) and not in this repo. Worth a separate ticket once SMTP is wired up.
- Do we want a "resend link" affordance on the "check your inbox" empty-state, or expect users to back out and re-enter the email? Default plan: a "didn't receive it? try again" link that resets the form. Cheap to add; revisit if real users complain.
