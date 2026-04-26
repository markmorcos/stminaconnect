# Tasks — add-servant-account-management

## 1. Server

- [ ] 1.1 Migration `007_servant_profile_rpcs.sql`:
  - `update_my_servant(display_name text)` — `SECURITY DEFINER`. Authenticates via `auth.uid()`. Validates `btrim(display_name) <> ''` and `length(display_name) <= 100`. Updates `servants.display_name` + `updated_at = now()` for `id = auth.uid()`. Returns the updated row.
  - `update_servant(servant_id uuid, payload jsonb)` — `SECURITY DEFINER`. Rejects non-admins with `'admin only'`. Whitelists `display_name` only in v1; unknown keys ignored. Same validation as above. Updates row + `updated_at`. Returns the updated row.
  - `revoke execute … from public; grant execute … to authenticated` for both.

## 2. Mobile API surface

- [ ] 2.1 `src/services/api/account.ts` — `updateMyServant(displayName)` wrapping `supabase.rpc('update_my_servant', { display_name })`. Returns the new `ServantRow`.
- [ ] 2.2 Extend `src/services/api/servants.ts` with `updateServant(servantId, payload)` (admin-side; surfaces a typed error on non-admin reject). Lands here so the admin dashboard can pick it up later.
- [ ] 2.3 Add `updateAuthEmail` is **not** added — keep email change off the surface.

## 3. Auth-store wiring

- [ ] 3.1 Extend `src/state/authStore.ts` with a `setServant(partial)` action (or equivalent) so the account screen can replace `servant.display_name` after a successful save without re-fetching the whole row.
- [ ] 3.2 Optionally add `refreshServant()` (calls `fetchMyServant` and overwrites the store) for the password-change success path; lower priority.

## 4. Account screen

- [ ] 4.1 `app/(app)/settings/account.tsx` mounts the account form within the existing `(app)/settings/_layout.tsx` Stack. Title comes from `t('settings.account.title')`.
- [ ] 4.2 `src/features/account/AccountForm.tsx`:
  - RHF + a small Zod schema `accountSchema` (`display_name: trimmedName100`).
  - Renders a `Card` with three sections in this order: Display name → Email (read-only) → Change password.
  - Save button (display name) is disabled when the value is unchanged and re-enabled on edit.
  - On success, dispatches `setServant({ display_name })` and surfaces a Paper `Snackbar` with `t('settings.account.saved')`.
- [ ] 4.3 `src/features/account/PasswordChangeModal.tsx`:
  - Paper `Modal` with three `Input`s (current, new, confirm) and a destructive-tone Save button.
  - Local Zod schema enforces min 8, new ≠ current, confirm == new.
  - Submit pipeline: `supabase.auth.signInWithPassword({ email: servant.email, password: current })` → on success, `supabase.auth.updateUser({ password: new })`. On the first call's error, surface inline error on the current-password field. On the second call's error, surface a snackbar.
  - Closes on success and shows `t('settings.account.passwordChanged')`.

## 5. Home menu entry

- [ ] 5.1 `app/(app)/index.tsx`: add a Paper `Menu.Item` "Account" between "Settings" and "Sign out", routing to `/settings/account`.

## 6. Translations

- [ ] 6.1 Extend `en.json`/`ar.json`/`de.json` with:
  - `home.account`
  - `settings.account.{title, displayNameLabel, emailLabel, emailReadOnly, save, saved, changePassword, passwordSection, currentPassword, newPassword, confirmPassword, passwordChanged}`
  - `settings.account.errors.{displayNameRequired, displayNameTooLong, currentPasswordWrong, newPasswordTooShort, newPasswordEqualsCurrent, confirmMismatch, generic}`

## 7. Tests

- [ ] 7.1 RPC integration: `update_my_servant` accepts a valid name, rejects empty, rejects > 100 chars (gated on `RUN_INTEGRATION_TESTS=1`).
- [ ] 7.2 RPC integration: `update_servant` succeeds for admin, rejects for non-admin, ignores unknown keys.
- [ ] 7.3 Component: `AccountForm` renders the three sections, disables Save when unchanged, surfaces validation errors.
- [ ] 7.4 Component: `PasswordChangeModal` blocks short / matching / mismatched values, calls `signInWithPassword` first, then `updateUser` on success.
- [ ] 7.5 i18n parity: the new keys exist in EN/AR/DE (covered by the existing parity test suite).

## 8. Verification (in Expo Go)

- [ ] 8.1 As a servant, change display name → home greeting reflects the new value without sign-out.
- [ ] 8.2 As a servant, attempt to clear the display name → inline error blocks save.
- [ ] 8.3 As a servant, change password with the wrong current → inline error on current field; password unchanged.
- [ ] 8.4 As a servant, change password successfully → snackbar; sign out; sign in with the new password works.
- [ ] 8.5 Email field is read-only with the localized hint visible.
- [ ] 8.6 Switch app to AR → all new strings render correctly.
- [ ] 8.7 `openspec validate add-servant-account-management` passes.
