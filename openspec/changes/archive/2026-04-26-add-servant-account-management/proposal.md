## Why

Servants currently have no in-app way to fix typos in their own display name or rotate their password — `display_name` is write-once at invite time, and password changes route through the "forgot password" flow as a de-facto reset. Both gaps force admins to edit rows in the Supabase Dashboard for routine self-service hygiene. This change closes the gap with one self-service screen and the minimum RPC surface to support it, before the admin dashboard ships.

## What Changes

- **ADDED** screen `app/(app)/settings/account.tsx`:
  - Display name: editable input with Save button.
  - Email: read-only with a localized helper "Contact an admin to change."
  - Change password: inline action that opens a small form (current password + new password + confirm). Re-verifies the current password via `supabase.auth.signInWithPassword` before calling `supabase.auth.updateUser({ password })`.
- **ADDED** RPC `update_my_servant(display_name text)` — non-empty, max 100 chars; bumps `updated_at`. Authenticated callers only.
- **ADDED** RPC `update_servant(servant_id uuid, payload jsonb)` — admin-only; whitelists `display_name` for v1 (extensible without another migration). The admin servants list (in `add-admin-dashboard`) wires this up later.
- **ADDED** Route entry from the Home menu → "Account" (between "Settings" and "Sign out").
- **ADDED** Translation keys `settings.account.*` (EN/AR/DE).
- **NOT INCLUDED** (deliberate non-goals): in-app email change, avatar/photo upload, MFA, account deletion. Email change is deferred because it touches `auth.users.email` (re-verification flow + a sync trigger to keep `servants.email` in step) and v1 sees email change as rare; admins handle it via Supabase Dashboard until a future change adds it.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `auth`: adds requirements for self-service profile management (display name + password) by an already-authenticated servant.

## Impact

- **Affected specs**: `auth` (modified — adds self-service profile requirements).
- **Affected code**: new `app/(app)/settings/account.tsx`, new `src/features/account/*` (form + password modal), new `src/services/api/account.ts` (or extension to `services/api/servants.ts`), `app/(app)/index.tsx` Home menu entry, `src/i18n/locales/{en,ar,de}.json` extensions.
- **Migrations**: one — `007_servant_profile_rpcs.sql` adding `update_my_servant` and `update_servant` RPCs.
- **Breaking changes**: none.
- **Expo Go compatible**: yes — Supabase Auth's `updateUser({ password })` and `signInWithPassword` work in Expo Go.
- **Uses design system**: all UI built with components/tokens from the design-system capability; no ad-hoc styles.
- **Dependencies**: `add-servant-auth`, `add-person-data-model` (only because the latter introduces `servants` RLS).
- **Roadmap slot**: phase 9 (immediately after `add-full-registration`); pushes the rest of the roadmap by one phase. No phase 9+ work depends on it; placing it here lets the gap be fixed before the admin dashboard ships, and keeps the change small (no notification or attendance machinery needed yet).
