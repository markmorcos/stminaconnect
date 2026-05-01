## 1. Auth store + hook

- [x] 1.1 Remove `signIn(email, password)` from `src/state/authStore.ts` — the action and its type on `AuthState`.
- [x] 1.2 Remove `verifyEmailOtp` from `src/state/authStore.ts` — the action and its type on `AuthState`.
- [x] 1.3 Remove `signIn` and `verifyEmailOtp` from the `useAuth` hook surface in `src/hooks/useAuth.ts`.
- [x] 1.4 Update `jest.setup.ts` mock — keep `signInWithOtp` (used by `signInWithMagicLink`), drop any password-flow stub if present.

## 2. Sign-in screen

- [x] 2.1 In `app/(auth)/sign-in.tsx`, delete `PasswordModeForm`, `PasswordValues`, and `passwordSchema`.
- [x] 2.2 Delete `OtpModeForm`, `OtpValues`, and `otpSchema`.
- [x] 2.3 Remove the `Mode` type, `mode` state, and the "switch to password / magic-link" toggle pressable.
- [x] 2.4 Replace the screen body with: header → `MagicLinkModeForm` (when `pendingEmail === null`) → "check your inbox" empty-state (when `pendingEmail !== null`).
- [x] 2.5 Build the empty-state component: surfaces the submitted email, a primary "didn't receive it? try again" link that calls back into `signInWithMagicLink` (resending), and a secondary "use a different email" link that resets `pendingEmail` to null.

## 3. Callback fail-fast

- [x] 3.1 In `app/auth/callback.tsx`, wrap `exchangeCodeForSession` and `setSession` awaits in a 10-second timeout that resolves to an error state.
- [x] 3.2 Confirm the existing `cancelled` cleanup interacts correctly with the timeout — no double `setStatus` calls, no leaked timers.

## 4. i18n cleanup

- [x] 4.1 Remove from `src/i18n/locales/en.json`:
  - `auth.signIn.passwordLabel`, `auth.signIn.submitPassword`, `auth.signIn.errors.passwordTooShort`
  - `auth.signIn.switchToPassword`, `auth.signIn.switchToMagicLink`
  - `auth.signIn.otpInstruction`, `auth.signIn.otpLabel`, `auth.signIn.submitOtp`
  - `auth.signIn.codeSentSnack`, `auth.signIn.errors.codeLength`, `auth.signIn.errors.codeDigitsOnly`
- [x] 4.2 Mirror deletions in `src/i18n/locales/de.json`.
- [x] 4.3 Mirror deletions in `src/i18n/locales/ar.json`.
- [x] 4.4 Add new keys to all three locales: `auth.signIn.checkYourInbox` (with `{{email}}` interpolation), `auth.signIn.resendLink`, `auth.signIn.useDifferentEmail` (verify whether already exists; reuse if so).

## 5. Tests

- [x] 5.1 Delete password-flow tests in `tests/auth/` — anything covering `signIn(email, password)` or `PasswordModeForm`.
- [x] 5.2 Delete OTP-flow tests in `tests/auth/` — anything covering `verifyEmailOtp` or `OtpModeForm`.
- [x] 5.3 Update / add magic-link tests: assert single-mode rendering (no password input, no OTP input, no mode toggle); assert "check your inbox" empty-state surfaces the email; assert "use a different email" resets the form; assert "didn't receive it? try again" re-invokes `signInWithMagicLink`.
- [x] 5.4 Add a callback-screen test for the missing-code-verifier path: simulate `exchangeCodeForSession` never resolving; assert the screen redirects to `/sign-in` within the 10s timeout window.
- [x] 5.5 Run the full suite: `npm test`. Fix any unexpected breakages from removed exports. _(User to run.)_

## 6. Supabase project config (manual, both environments)

- [x] 6.1 In the **preview** Supabase project (`ljnuaefrsfscqnywvojd`): Authentication → Providers → Email — disable the "Enable Email password" toggle. Save.
- [x] 6.2 In the **production** Supabase project (`hdcwafpagxujovqivzzz`): same change. Save.
- [x] 6.3 Verify with `curl`: `POST https://<ref>.supabase.co/auth/v1/token?grant_type=password -H 'apikey: <anon>' -d '{"email":"x","password":"y"}'` should return a 4xx with a "password disabled" error rather than an auth attempt.

## 7. Docs

- [x] 7.1 Update `docs/dev-build.md` § 5 to describe the single magic-link flow — drop password and OTP fallback prose.
- [x] 7.2 Update `README.md` § Sign-in to reflect the single flow.

## 8. Verification

- [x] 8.1 `npx tsc --noEmit` — green.
- [x] 8.2 `npm run lint` — green.
- [x] 8.3 Manual smoke test on the preview build: sign in via magic link end-to-end; verify "check your inbox" renders; verify "try again" resends; verify "use a different email" resets; verify a stale link (after reinstall) redirects to `/sign-in` within 10s rather than spinning; verify there is no path to a password or OTP input from any sign-in state.
- [x] 8.4 `openspec validate magic-link-only-auth` — green.
