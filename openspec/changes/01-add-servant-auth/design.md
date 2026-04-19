## Context

Supabase Auth gives us an `auth.users` table we cannot extend directly, so every product feature needs some join table for role + profile attributes. This change decides the shape of that table, the invitation flow, and how the mobile app knows "who am I and what can I do" at runtime.

The congregation has ~15 servants. Any flow that's more than 3 screens or requires SSO setup is overkill. Magic-link is the sweet spot: no password management for the servant, and servants already use email regularly.

## Goals

- A new servant can be onboarded end-to-end (admin sends invite → servant receives email → signs in) without any admin interaction with Supabase Studio.
- The mobile app knows whether the current user is `admin` or `servant` before any protected screen renders.
- Sessions persist across app restarts. Users do not re-authenticate daily.
- Deactivating a user immediately invalidates their access (blocks sign-in and revokes existing sessions).
- The role model is simple enough to extend later (v2 might add `read_only_admin`) without a rewrite.

## Non-Goals

- No SSO (Google / Microsoft) in v1. Adds provider complexity with low user demand.
- No self-service password reset UI — magic link covers forgotten passwords.
- No MFA in v1. Revisit post-launch.
- No audit log of logins beyond what Supabase Auth already records.
- No in-app invitation redemption UI; the magic-link flow goes through the system browser and deep-links back.

## Decisions

1. **`profiles` table, 1:1 with `auth.users`, FK on `id`.** Row created on first sign-in via an Auth webhook (or inserted by a `handle_new_user()` trigger — we use the trigger, which is the canonical Supabase pattern). The trigger reads invite metadata from `auth.users.raw_user_meta_data` to populate `role` and `display_name`.

2. **Invitation is an Edge Function, not a plain RPC.** The function runs with the service role key to call `auth.admin.inviteUserByEmail`. It also validates that the caller is an admin by verifying their JWT. We can't do this from a regular RPC because `auth.admin.*` requires service role.

3. **Role enum: `admin | servant` — single-role.** See Open Question #11. No user can be both; if a priest wants to be operationally assigned members, their role stays `admin`.

4. **Deactivation = `profiles.active = false` + Auth "ban" via the admin API.** Setting `active = false` is a soft signal consumed by RLS policies (which consult `active` in the `auth_context` check); banning via Auth admin API is the hard revocation and forces all refresh tokens to fail. We do both.

5. **`auth_context()` RPC as the source of truth.** Mobile calls this once on session load; it returns `{ user_id, role, active, display_name }`. This avoids re-querying `profiles` in RLS policies (we JOIN against `profiles` directly, but for the mobile UI we want a clean, typed result).

6. **Session persistence via `expo-secure-store` + `supabase-js`'s built-in storage adapter.** Not AsyncStorage (less secure for tokens). The Supabase client is configured with a custom adapter that reads/writes via SecureStore.

7. **Magic-link deep link uses the app's custom scheme (`stminaconnect://auth-callback`)** configured in Expo's `app.config.ts`. No Universal Links in v1 (requires apple-app-site-association + hosting, out of scope).

## Risks / Trade-offs

- **Risk:** If the Auth trigger fails (e.g. `raw_user_meta_data` missing expected field), the user authenticates but has no profile, and the app renders a confusing state. **Mitigation:** on mobile, if `auth_context` returns null, show a "Your account is not fully set up — contact an admin" error state instead of looping.
- **Trade-off:** Relying on `raw_user_meta_data` for role during invite means the role is mutable via the Supabase admin API, not via our app. That's fine — admins change roles via our "Manage Servants" screen (added in `add-admin-dashboard`), which updates `profiles.role` directly, not the Auth metadata. The trigger is only for *initial* seeding.
- **Trade-off:** Magic-link emails can end up in spam. We mitigate by documenting this in the root README and by optionally sending passwords later if needed — this change includes a password-fallback flow.

## Migration Plan

- Migration `001_create_profiles.sql` creates the `profiles` table, the role enum, and the `handle_new_user()` trigger.
- Migration `002_auth_context_rpc.sql` creates `auth_context()` and the `deactivate_user(user_id uuid)` RPC.
- No data to migrate — table starts empty. Admin manually creates the first admin via `supabase dashboard` or via a one-time seed script that runs with the service role key and marks a designated email as `admin`.

## Open Questions

See `_open-questions.md` #1, #9, #11. Defaults chosen in those items are assumed here.
