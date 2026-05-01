## Why

The dev-client/preview build now reliably handles the `stminaconnect://auth/callback` deep link, so magic-link sign-in is the canonical path in practice. The other two flows the app supports — 6-digit OTP-typing and email/password — are now redundant. OTP duplicates magic-link with extra friction (typing digits vs. one tap from the same email). Email/password adds a whole category of UX no one in this app needs: password fields, "forgot password", password reset emails, password complexity rules, password-store concerns. Servants sign in rarely (sessions persist across restarts), there is no public sign-up, and the user base is small enough that one auth path is all this app needs.

Removing both flows simplifies the sign-in screen to a single email field, deletes ~150 lines of UI + form schemas + tests, and leaves Supabase Auth's magic link as the single way in.

## What Changes

- **BREAKING** Remove the email/password sign-in flow. No password input, no `signIn(email, password)` action, no "forgot password" surface (none existed in v1, but the door is closed for good).
- **BREAKING** Remove the 6-digit OTP-typing flow. The "Email me a code" branch ends at "check your inbox" — the user taps the magic link, not types a 6-digit code.
- Sign-in screen becomes a single-mode form: email field + "Send magic link" button + post-submit "check your inbox" empty-state.
- Drop `signIn` and `verifyEmailOtp` from the auth store and the `useAuth` hook surface; keep only `signInWithMagicLink`.
- Drop `PasswordModeForm` and `OtpModeForm` from `app/(auth)/sign-in.tsx`. Remove the `Mode` toggle entirely.
- Drop password / OTP i18n keys from EN/DE/AR locale files.
- Update the magic-link callback (`app/auth/callback.tsx`) so a missing code-verifier scenario fails fast (≤10s) to `/sign-in` instead of spinning indefinitely.
- Drop OTP and password-flow integration tests; expand magic-link tests to cover the "check your inbox" empty-state and the missing-verifier failure path.
- Document a one-time Supabase Auth project setting: disable email/password provider at the project level on both preview and production projects, to keep the door closed at the API layer too.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `auth`: Reduce to a single sign-in flow — emailed magic link via `stminaconnect://auth/callback`. Email/password is dropped as a primary flow; OTP-typing is dropped as an alternate. Requirement 1 is rewritten in place: scenarios now cover magic-link success, magic-link failure (no verifier), and the absence of password / OTP input fields. Sessions-persist requirement is unchanged.

## Impact

- **Code**: `src/state/authStore.ts` (remove `signIn`, `verifyEmailOtp`), `src/hooks/useAuth.ts` (drop both from the surface), `app/(auth)/sign-in.tsx` (delete `PasswordModeForm` + `OtpModeForm`, drop `Mode` toggle, simplify to single form), `app/auth/callback.tsx` (add fail-fast timeout), `src/i18n/locales/{en,de,ar}.json` (drop password and OTP keys).
- **Tests**: `tests/auth/*password*` and `tests/auth/*otp*` removed; `tests/auth/magicLink*` and `tests/auth/callback*` expanded.
- **Specs**: `auth/spec.md` Requirement 1 rewritten — title, body, and scenarios reduced to the magic-link-only world.
- **Supabase project config (manual, per environment)**: disable Email/Password provider in Authentication → Providers on both preview and production projects.
- **Docs**: `docs/dev-build.md` § 5 simplified; `README.md` § Sign-in rewritten to describe the single flow.
- **No DB / migration / Edge Function impact** — the same Supabase magic-link email is what's already in flight; we're removing client paths, not server paths.
