# auth — Spec Delta

## ADDED Requirements

### Requirement: An authenticated servant SHALL be able to update their own display name from an in-app account screen.

The app MUST surface an Account screen at `/settings/account` reachable from the home overflow menu. The screen MUST present the servant's current `display_name` in an editable input and a Save button. Submitting MUST call the `update_my_servant(display_name)` RPC, which MUST validate non-empty and length ≤ 100 characters and bump `updated_at`. After a successful save the auth store's `servant.display_name` SHALL reflect the value returned by the RPC. The screen MUST be reachable only by an authenticated servant.

#### Scenario: Servant updates display name successfully

- **GIVEN** servant S is signed in with `display_name='Old Name'`
- **WHEN** S opens `/settings/account`, replaces the field with `'New Name'`, and taps Save
- **THEN** `update_my_servant('New Name')` is called
- **AND** the auth store's `servant.display_name` is `'New Name'`
- **AND** the home greeting reflects `'New Name'` after navigating back

#### Scenario: Display name validation blocks empty values

- **GIVEN** servant S on `/settings/account`
- **WHEN** S clears the display-name field and taps Save
- **THEN** the form surfaces an inline localized error
- **AND** no RPC is called

#### Scenario: Display name length is enforced server-side

- **GIVEN** servant S on `/settings/account`
- **WHEN** S submits a 200-character `display_name`
- **THEN** `update_my_servant` rejects with an error
- **AND** the screen surfaces a localized error

### Requirement: A signed-in servant SHALL be able to change their password after re-verifying the current one.

The Account screen MUST expose a "Change password" action that opens a Paper modal with three fields: current password, new password, confirm password. On submit the app MUST first call `supabase.auth.signInWithPassword` against the current servant's email with the provided current password; on success it MUST call `supabase.auth.updateUser({ password: new })`. The new password MUST be at least 8 characters and MUST differ from the current password (client-side check). The active session SHALL remain valid throughout — the verification call's session is discarded.

#### Scenario: Successful password change

- **GIVEN** servant S is signed in with email `s@example.com` and current password `oldPass123`
- **WHEN** S opens the password modal, types `oldPass123`, `newPass456`, `newPass456`, and taps Save
- **THEN** `signInWithPassword({ email: 's@example.com', password: 'oldPass123' })` succeeds
- **AND** `updateUser({ password: 'newPass456' })` succeeds
- **AND** the modal closes and a localized success snackbar appears
- **AND** the active session is still valid (no sign-out occurred)

#### Scenario: Wrong current password rejects

- **GIVEN** servant S in the password modal
- **WHEN** S types a wrong current password and taps Save
- **THEN** `signInWithPassword` fails
- **AND** an inline localized error appears on the current-password field
- **AND** `updateUser` is not called

#### Scenario: New password too short rejects client-side

- **GIVEN** servant S in the password modal
- **WHEN** the new password is fewer than 8 characters
- **THEN** the form surfaces an inline localized error
- **AND** no RPC is called

#### Scenario: New password equal to current rejects client-side

- **GIVEN** servant S in the password modal with `current = 'sameOne1'`
- **WHEN** the new password is also `'sameOne1'`
- **THEN** the form surfaces an inline localized error
- **AND** no RPC is called

### Requirement: Email SHALL be displayed as read-only on the account screen.

The Account screen MUST render the servant's email in a read-only `TextInput` with `editable={false}` and a localized helper line directing the user to contact an admin for changes. There MUST NOT be a "Change email" button or modal. The application MUST NOT call `supabase.auth.updateUser({ email })` from any client code path in v1.

#### Scenario: Email is not editable

- **GIVEN** servant S on `/settings/account`
- **WHEN** S taps the email field
- **THEN** no editing affordance appears (keyboard does not open, no cursor)
- **AND** a localized helper "Contact an admin to change" is visible below the field

### Requirement: An admin RPC SHALL allow updating another servant's display name.

The system MUST expose `update_servant(servant_id uuid, payload jsonb)` as a `SECURITY DEFINER` Postgres RPC. It MUST reject non-admin callers. It MUST whitelist `display_name` only in v1 and MUST validate the same constraints as `update_my_servant` (non-empty, ≤ 100 chars). Unknown payload keys MUST be ignored without error so the contract is forward-compatible. The function MUST bump `updated_at` and return the updated row.

#### Scenario: Admin updates another servant's display name

- **GIVEN** admin A and servant S2 with `display_name='Volunteer Two'`
- **WHEN** A calls `update_servant(S2.id, '{"display_name": "S. Two"}'::jsonb)`
- **THEN** the RPC succeeds
- **AND** S2's `display_name` is `'S. Two'`
- **AND** `updated_at` is recent

#### Scenario: Non-admin caller is rejected

- **GIVEN** servant S1 (non-admin) and servant S2
- **WHEN** S1 calls `update_servant(S2.id, '{"display_name": "anything"}'::jsonb)`
- **THEN** the RPC raises an `'admin only'` error

#### Scenario: Unknown payload keys are ignored

- **GIVEN** admin A
- **WHEN** A calls `update_servant(S2.id, '{"display_name": "Ok", "role": "admin"}'::jsonb)`
- **THEN** `display_name` is updated
- **AND** `role` is unchanged
- **AND** the call returns success
