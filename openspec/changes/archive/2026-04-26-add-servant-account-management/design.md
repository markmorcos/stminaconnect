## Context

Servants currently have no in-app self-service. Their `display_name` is set at invite time (via the future `invite_servant` flow) and then immutable from the app; their password is changeable only by going through the "forgot password" emailed-OTP path. Admins fielding "fix my display name" or "I want to change my password without losing my session" requests have to use the Supabase Dashboard.

This change adds a thin self-service surface ahead of the admin dashboard, so the gap is closed without waiting for the heavier admin-management screen later.

## Goals / Non-Goals

**Goals:**

- Authenticated servants can update their own `display_name` and password without admin help.
- Admin gets a server-side hook (`update_servant(servant_id, payload)`) that the future admin dashboard wires into a per-row "Edit name" affordance — no rework when the admin screen lands.
- The change ships a single screen (`/settings/account`) with three controls; no other surfaces touched.
- Email stays read-only for v1, surfaced with a localized hint pointing at the admin.

**Non-Goals:**

- In-app email change. Touching `auth.users.email` is a multi-step flow (re-verification, sync trigger, session refresh) that v1 doesn't need — change is rare.
- Avatar / photo upload (project-wide v1 non-goal — see `project.md` § 1e).
- MFA / 2FA. Out of scope for the early phases.
- Account deletion. Deactivation lands later in `add-admin-dashboard`.
- Editing other servants' `display_name` from this change. The admin RPC ships here, but the UI hook lands in `add-admin-dashboard`.

## Decisions

1. **Single account screen at `/settings/account`** — slotted under the existing `/settings/*` tree (next to `/settings/language`) rather than a top-level `/account` route, keeping the settings tree shallow. Reachable from the Home overflow menu via a new "Account" item between "Settings" and "Sign out".

2. **Three controls, not three screens.** Display name (always editable), Email (read-only with hint), Change password (button → modal). One round trip per save; nothing modal nests beyond one level deep. Justified by the change being deliberately small.

3. **`update_my_servant(display_name)` is intentionally narrow.** Only one field, validated in SQL (`btrim(display_name) <> ''`, `length(display_name) <= 100`). Future fields (e.g. preferred locale) get added as additional positional arguments or by widening to a payload — but only when there's a concrete need.

4. **`update_servant(servant_id, payload jsonb)` is admin-only and payload-shaped.** Mirrors the `update_person` pattern from migration 006. v1 whitelists only `display_name`; future fields can be added without another migration. Admin gating is `is_admin()`. The admin servants screen in `add-admin-dashboard` wires this up.

5. **Password change requires re-auth with current password.** Supabase JS allows calling `auth.updateUser({ password })` on a fresh session without proving knowledge of the current one — that's a session-hijack risk. The flow:
   - User opens the password modal, types current + new + confirm.
   - On submit: `signInWithPassword({ email, password: current })` against the current servant's email. If that succeeds, call `auth.updateUser({ password: new })`. If it fails, surface an inline error.
   - This adds one round trip but closes the hijack hole. The session token returned by the second sign-in is discarded; we do not replace the active session — the user keeps their current one. (Supabase rotates the access-token on `updateUser` automatically.)

6. **Password client-side validation: minimum length 8.** Matches the existing servant-auth sign-in floor (no upper-cap, no character-class rules — we trust users not to choose `password123`). The new password must also differ from the current one (cheap client check; SQL would have to plaintext-compare which we can't).

7. **Display name change is server-authoritative for the auth store.** After `update_my_servant` returns, the mobile auth store's `servant.display_name` is replaced with the value from the RPC's row response (not the form value), so the home greeting reflects whatever the server actually persisted.

8. **Email is read-only with a localized hint.** Rendered as a Paper `TextInput` with `editable={false}` plus a helper line: `t('settings.account.emailReadOnly')`. No "Request email change" button in v1 — the support path is "ping an admin." Documented in the screen's i18n string.

9. **No optimistic UI.** Submit shows a Paper `ActivityIndicator` on the Save / Change-password buttons, disables them during the in-flight request, and only flips state on RPC success. Consistent with the rest of the app's form pattern (Quick Add, Full Registration).

10. **No new design-system primitives.** The screen builds entirely on existing tokens + components (`Input`, `Button`, `Card`, `Stack`, `Snackbar`, Paper `Modal` for the password form). No tokens added; no design-system gap filed.

## Risks / Trade-offs

- **Risk**: a servant could change their display name to something inappropriate (e.g. impersonation). **Mitigation**: this is in scope for the team-trust model (servants are vetted volunteers, not public sign-ups). If it becomes a real problem, `update_servant` already gives admins one-click correction.
- **Risk**: re-auth-with-current-password adds latency to the password change. **Mitigation**: it's a deliberate one-time speed-bump on a rarely-used flow; users won't notice.
- **Risk**: leaving email read-only creates a support workload (admins editing rows in Supabase Dashboard). **Mitigation**: accepted for v1. Email change is a future change once we observe how often it actually comes up. The screen surfaces a localized "ping an admin" hint so users don't bounce around looking for the option.
- **Trade-off**: bundling the admin RPC (`update_servant`) into this change without an admin UI consumer feels speculative. Counter: it's 15 lines of SQL, lets the admin dashboard land without an awkward "wait, we need another migration first" moment, and the gating is symmetric with the rest of the codebase (`is_admin()`).

## Migration Plan

- One forward-only migration: `007_servant_profile_rpcs.sql` adds two RPCs (`update_my_servant`, `update_servant`). Idempotent (`create or replace function`). No data migration needed; no schema changes.
- No rollback required — dropping the RPCs would break the new screen but no other code paths reference them.

## Open Questions

- **A1** (deferred): should display-name changes hit `assignment_history` style audit trail? Decision: **no** for v1 — display name is identity hygiene, not pastoral state. Re-evaluate if `add-gdpr-compliance`'s audit log scope expands.
- **A2** (deferred): expose a "Last changed" timestamp on each control? Decision: **no** for v1 — the row's `updated_at` already covers it for admin debugging via the Dashboard.
