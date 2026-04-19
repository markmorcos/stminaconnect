## 1. Database

- [ ] 1.1 Create migration `001_create_profiles.sql`: `user_role` enum (`admin`, `servant`); `profiles` table with (`id` FK to `auth.users`, `role`, `display_name`, `active boolean default true`, `created_at`, `updated_at`)
- [ ] 1.2 Create `handle_new_user()` trigger function that inserts a `profiles` row on `auth.users` insert, reading role + display_name from `raw_user_meta_data` with defaults (`role = 'servant'`, `active = true`)
- [ ] 1.3 Create migration `002_auth_context_rpc.sql`: `auth_context()` RPC returning current user's `(user_id, role, active, display_name)`; `deactivate_user(target uuid)` RPC that checks caller is admin, flips `profiles.active = false`, and calls `auth.admin.delete_refresh_tokens`
- [ ] 1.4 Add RLS policies for `profiles`: users can SELECT/UPDATE their own row (except `role` and `active`); admins can SELECT/UPDATE any row
- [ ] 1.5 Write integration tests (Jest + pg) verifying RLS: servant cannot read another profile; admin can; deactivated user cannot call `auth_context` successfully
- [ ] 1.6 Update seed script to create one admin account (email from `SEED_ADMIN_EMAIL` env var); print the magic-link URL for local use

## 2. Edge Function: invite-user

- [ ] 2.1 Scaffold `supabase/functions/invite-user` with Deno entry point
- [ ] 2.2 Implement: verify caller JWT, check caller is admin via `auth_context`, accept `{ email, role, display_name }`, call `auth.admin.inviteUserByEmail` with `data: { role, display_name }` in the metadata, return success or structured error
- [ ] 2.3 Add Deno tests covering: non-admin caller rejected; invalid email rejected; happy path returns invite token
- [ ] 2.4 Wire into `make test` and `make deploy-functions`

## 3. Mobile: auth plumbing

- [ ] 3.1 Install `@supabase/supabase-js` and configure a singleton client in `services/api/supabase.ts` using `expo-secure-store` as the storage adapter
- [ ] 3.2 Add `services/api/auth.ts` wrappers: `signInWithOtp(email)`, `signInWithPassword(email, password)`, `signOut()`, `getSessionContext()` (calls `auth_context` RPC)
- [ ] 3.3 Add `stores/session.ts` (Zustand): holds `{ user, role, active, loading, error }`; subscribes to `supabase.auth.onAuthStateChange` and refreshes context
- [ ] 3.4 Configure Expo deep-link scheme `stminaconnect://` in `app.config.ts`; handle the `auth-callback` deep link to complete the magic-link sign-in
- [ ] 3.5 Unit tests for session store: transitions between `unauthenticated`, `loading`, `authenticated-servant`, `authenticated-admin`, `deactivated`

## 4. Mobile: screens

- [ ] 4.1 Build `app/(auth)/login.tsx`: email field + "Send magic link" button; "Use password instead" secondary flow
- [ ] 4.2 Build `app/(auth)/magic-link-sent.tsx`: confirmation screen with "Check your email"
- [ ] 4.3 Build `app/_layout.tsx` gate: redirect to `(auth)` if unauthenticated; to `(tabs)` if authenticated; show spinner during loading; show error screen for deactivated users
- [ ] 4.4 Build minimal authenticated home at `app/(tabs)/index.tsx`: "Welcome, <display_name>" + "Sign out" button
- [ ] 4.5 RTL/i18n-ready strings in all screens (English only in this change; full translations come in `add-i18n-foundation`)
- [ ] 4.6 React Native Testing Library tests for login form validation and the session-gate layout

## 5. Verification

- [ ] 5.1 Manual: seed script creates admin; admin calls invite-user; servant receives magic link; clicks; is signed in; sees home with their name
- [ ] 5.2 Manual: admin calls `deactivate_user` on the servant; servant is signed out on next app foreground
- [ ] 5.3 `make test`, `make lint`, `make typecheck` pass
- [ ] 5.4 `openspec validate add-servant-auth` passes
- [ ] 5.5 Manual verification: every scenario in `specs/auth/spec.md` walks through green
