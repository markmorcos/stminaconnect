## Why

The app is servant-only — every feature beyond the public-facing nothing-yet placeholder requires an authenticated session. Adding auth now (before any feature code) means we never have to retrofit "is this user logged in?" branches into existing flows. We use Supabase Auth with email/password and a 6-digit emailed code only — Google Sign-In is forbidden in v1 because it requires a development build, and the magic-link deep link can't be exercised in Expo Go (the local GoTrue build silently rejects `exp://` redirects).

## What Changes

- **ADDED** capability `auth`.
- **ADDED** `servants` table (minimal v1 shape: `id` (auth.users FK), `email`, `displayName`, `role` (`admin` | `servant`), `createdAt`, `updatedAt`, `deactivatedAt`). Full RLS later.
- **ADDED** Supabase Auth integration in `services/api/supabase.ts` with AsyncStorage-backed session persistence.
- **ADDED** Sign-in screen (`app/(auth)/sign-in.tsx`) supporting two flows: email/password and an emailed 6-digit one-time code (verified via `verifyOtp({ type: 'email' })`).
- **ADDED** Magic-link landing page (`app/(auth)/callback.tsx`) handling the deep-link redirect from email — used by production builds via the `stminaconnect://` scheme. Expo Go users follow the OTP-code path instead.
- **ADDED** Auth state store (`src/state/authStore.ts`) using Zustand: `session`, `servant` (joined row), `isLoading`, `signIn`, `signInWithMagicLink`, `verifyEmailOtp`, `signOut`.
- **ADDED** Route guarding: `app/(app)/_layout.tsx` redirects unauthenticated users to `/sign-in`; `app/(auth)/_layout.tsx` redirects authenticated users to `/`.
- **ADDED** Sign-out button on a temporary "Account" screen (will be folded into proper settings in later phases).
- **ADDED** Role concept: `role` enum on `servants`, plumbed into the auth store but not yet enforced (no admin-only screens exist yet).
- **ADDED** Manual servant onboarding documented in README: admin creates a row in `auth.users` via Supabase Dashboard, then a matching row in `servants` (initial cohort path; phase 13 adds an in-app "Invite Servant" admin UI).

## Impact

- **Affected specs**: `auth` (new).
- **Affected code**: `app/(auth)/*`, `app/(app)/_layout.tsx`, `src/services/api/supabase.ts`, `src/state/authStore.ts`, `src/services/api/servants.ts`. New migration: `001_servants.sql`.
- **Breaking changes**: none (no prior auth).
- **Migration needs**: first SQL migration. RLS on `servants`: a servant can read their own row; admins can read all rows.
- **Expo Go compatible**: yes — email/password and the emailed 6-digit OTP both work in Expo Go. The deep-link side of the magic-link mail is dormant in Expo Go (GoTrue rejects the `exp://` redirect); production standalone builds activate it via the `stminaconnect://` scheme.
- **Uses design system**: all UI built with components/tokens from the design-system capability. No ad-hoc styles.
- **Dependencies**: `init-project-scaffolding`, `setup-design-system`, `add-brand-assets`.
