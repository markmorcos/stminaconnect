## Why

Quick Add captures bare contact info; pastoral follow-up requires more — priority, intentional servant assignment, private comments. Servants also need to _upgrade_ a Quick Add row to a Full row (e.g. after a follow-up call) and edit existing person profiles. This change introduces the Full Registration form, the upgrade flow, and the profile edit screen — completing the person-management lifecycle the Quick Add change deliberately left open.

## What Changes

- **MODIFIED** `registration` capability — adds Full Registration flow.
- **MODIFIED** `person-management` capability — adds edit affordances.
- **ADDED** Full Registration screen `app/(app)/registration/full.tsx`:
  - All Quick Add fields PLUS Priority (radio: High/Medium/Low/Very Low), Assigned Servant (picker), Comments (multiline text).
  - Reachable from home (secondary CTA "Register full") and from a Quick Add upgrade button on the person profile.
  - Same duplicate detection as Quick Add; same RPC (`create_person`) with `registration_type='full'`.
- **ADDED** "Upgrade to Full" button on the person profile when `registration_type = 'quick_add'`. Tapping opens the Full Registration form pre-filled with the existing fields.
- **ADDED** Edit Profile screen `app/(app)/persons/[id]/edit.tsx`:
  - All fields editable depending on caller's permissions.
  - Comments field visible only if caller is admin or assigned servant.
  - Reassign-Servant control: admin-only.
  - Calls `update_person` RPC.
- **ADDED** Soft-delete control on profile (admin-only): "Remove member" button with confirmation dialog, calls `soft_delete_person`.
- **ADDED** Translation keys for `registration.full.*`, `persons.edit.*`, `persons.delete.*`.
- **MODIFIED** `update_person` RPC: enforces field-level permissions (servants cannot change `priority`, `assigned_servant`; only admins can).

## Impact

- **Affected specs**: `registration` (modified — Full added), `person-management` (modified — edit/upgrade/delete added).
- **Affected code**: `app/(app)/registration/full.tsx`, `app/(app)/persons/[id]/edit.tsx`, `app/(app)/persons/[id].tsx` (adds Edit + Upgrade buttons), `src/features/registration/full/*`, `src/features/persons/edit/*`, `src/services/api/persons.ts` (no API change — already exposes `updatePerson` and `softDeletePerson`).
- **Breaking changes**: none.
- **Migration needs**: SQL revision to `update_person` field-permission whitelist.
- **Expo Go compatible**: yes.
- **Uses design system**: all UI built with components/tokens from the design-system capability. No ad-hoc styles.
- **Dependencies**: `add-quick-add-registration`, `add-person-data-model`.
