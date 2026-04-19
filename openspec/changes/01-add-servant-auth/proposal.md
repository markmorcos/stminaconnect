## Why

Before any data is captured, we need a way for servants and admins to sign in. This change stands up Supabase Auth, an invitation flow (admin-initiated), login/logout screens, persistent sessions, and the role foundation (`servant` | `admin`) that every subsequent feature's RLS policies will depend on.

We deliberately avoid self-signup: only invited users can create accounts, ensuring no random person with the app URL can access member data.

## What Changes

- **ADDED** `auth` capability:
  - Supabase Auth configured for magic-link + password sign-in.
  - `profiles` table (1:1 with `auth.users`) holding role, display name, and activation state.
  - Admin invitation flow: admin enters email + role; server sends magic-link; on first sign-in, the `profiles` row is created / activated.
  - Login screen (magic-link request + fallback password).
  - Authenticated session persistence across app restarts using `expo-secure-store`.
  - Logout with full token + local-cache wipe.
  - Servant deactivation (admin action; blocks the user from signing in).
  - `auth_context` helper RPC returning the current user's role + id, consumed by the mobile app at session boot.
- Foundation only — no members, no features yet; the only screen behind auth is a "Welcome, <name>" placeholder.

## Impact

- **Affected specs:** `auth` (new)
- **Affected code (preview):**
  - DB: `profiles` table, RLS policies on `profiles`, `auth_context` RPC, `deactivate_user` RPC (admin only).
  - Edge Function: `invite-user` (uses service role to create user and send magic link).
  - Mobile: `app/(auth)/login.tsx`, `app/(auth)/magic-link-sent.tsx`, `app/_layout.tsx` (session gating), `services/api/auth.ts`, `stores/session.ts`.
- **Breaking changes:** none (first auth layer).
- **Migration needs:** first migration file `001_create_profiles.sql`.
- **Depends on:** `init-project-scaffolding`.
