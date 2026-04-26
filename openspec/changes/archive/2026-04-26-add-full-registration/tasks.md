# Tasks — add-full-registration

## 1. Server

- [x] 1.1 Migration `006_update_person_revision.sql`:
  - Drop and recreate `update_person(person_id uuid, payload jsonb)` with field-level permission logic.
  - Reject `assigned_servant` in `update_person`'s payload (caller must use `assign_person`).
  - Allow `priority`, `status`, `paused_until` only when caller is admin.
  - Allow `comments` only when caller is admin or `persons.assigned_servant`.

## 2. Shared form component

- [x] 2.1 `src/features/registration/full/FullRegistrationForm.tsx`:
  - Props: `mode`, `initialValues`, `personId`, `onSubmitSuccess`.
  - Renders all 8 fields (5 Quick Add + Priority + Assigned Servant + Comments).
  - Disables admin-only fields when caller is non-admin.
  - Conditionally hides Comments per visibility rules.
  - Uses RHF + Zod schema `fullRegistrationSchema`.
- [x] 2.2 `src/features/registration/full/schemas/fullRegistrationSchema.ts`.
- [x] 2.3 `src/features/registration/full/hooks/useFullRegistrationSubmit.ts`: branching by `mode`; in `edit` mode, splits into `assign_person` + `update_person` if assigned_servant changed.

## 3. Screens

- [x] 3.1 `app/(app)/registration/full.tsx` — mounts the form in `create` mode, default values from `useAuth()` for the assigned-servant default.
- [x] 3.2 `app/(app)/persons/[id]/edit.tsx` — fetches person via `getPerson`, mounts the form in `edit` mode.
- [x] 3.3 In `app/(app)/persons/[id].tsx` profile view:
  - Add an "Edit" button (header right). Visible always; respects field-level permissions inside the form.
  - Add an "Upgrade to Full" button when `registration_type === 'quick_add'`. Routes to edit screen with `?upgrade=true`.
  - Add a "Remove member" button (admin-only) at the bottom; opens confirmation dialog.

## 4. Soft-delete dialog

- [x] 4.1 Component `RemoveMemberDialog`: text input requires typing the full name; Confirm button enabled only when names match exactly. Calls `softDeletePerson` on confirm.

## 5. Home screen update

- [x] 5.1 Add a secondary CTA "Register full" tile, routes to `/registration/full`.

## 6. Translations

- [x] 6.1 Extend `en.json` / `ar.json` / `de.json`:
  - `registration.full.{title, priority.high, priority.medium, priority.low, priority.veryLow, assignedServant, comments, save, success}`.
  - `persons.edit.{title, save, success, errorPermissionField}`.
  - `persons.delete.{button, dialogTitle, dialogBody, typedConfirmPlaceholder, confirm, cancel, success}`.
  - `persons.upgrade.{button}`.

## 7. Tests

- [x] 7.1 RPC integration: `update_person` from a non-admin servant — succeeds for `first_name` change; rejects `priority` change.
- [x] 7.2 RPC integration: `update_person` from an admin succeeds for all whitelisted fields.
- [x] 7.3 RPC integration: `update_person` payload containing `assigned_servant` is rejected with a clear message.
- [x] 7.4 RPC integration: `update_person` rejects `comments` change from non-assigned non-admin.
- [x] 7.5 Component: Full form in `create` mode shows all fields; in `edit` mode prefills; non-admin sees Priority radio disabled.
- [x] 7.6 Component: Remove dialog button stays disabled until typed name matches.

## 8. Verification (in Expo Go)

- [x] 8.1 As servant, navigate to a Quick-Add person → tap "Upgrade to Full" → form prefilled, can add comments → save → profile reflects new fields, `registration_type` is `'full'`.
- [x] 8.2 As servant, edit own assigned person's comments → success.
- [x] 8.3 As servant, attempt to change Priority — control disabled.
- [x] 8.4 As admin, reassign a person → `assignment_history` row appears (verify in DB).
- [x] 8.5 As admin, delete a member with typed confirmation → list excludes the row; profile (if visited) shows scrubbed PII.
- [x] 8.6 Switch app to AR → all new strings render correctly.
- [x] 8.7 `openspec validate add-full-registration` passes.
