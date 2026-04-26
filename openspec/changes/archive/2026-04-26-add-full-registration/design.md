## Context

Full Registration is the servant's "real" registration: longer, less time-sensitive, often done sitting down after the service. The same form serves three purposes — initial Full Registration, upgrading a Quick Add row, and editing an existing profile. We unify these because they are 95% the same UI; differences are server-side.

## Goals

- One reusable form component handles new-Full, upgrade-from-Quick, and edit.
- Field-level permissions enforced server-side (RPC) and reflected in UI (disabled fields).
- Comments privacy preserved end-to-end.
- Reassignment goes through the existing `assign_person` RPC so history is logged.

## Non-Goals

- Bulk edit. One person at a time.
- Photo / attachment fields.
- A separate "search-and-link family" flow. Free-text region is enough for v1.
- Audit log UI. `assignment_history` exists in the DB but no UI surfaces it yet (deferred to phase 13 or beyond).

## Decisions

1. **Single shared form component**: `FullRegistrationForm` accepts `mode: 'create' | 'upgrade' | 'edit'`, optional `initialValues`, and `personId` (for edit/upgrade). Mode controls submit behaviour:
   - `create` → `create_person` with `registration_type='full'`.
   - `upgrade` → `update_person` setting `registration_type='full'` plus the new payload fields. Quick-Add fields are still editable.
   - `edit` → `update_person` with the changed-fields payload.
2. **Field-level permissions** in `update_person`:
   - Always allowed (any signed-in servant): `first_name`, `last_name`, `phone`, `region`, `language`, `comments` (if caller is admin or assigned servant).
   - Admin-only: `priority`, `status`, `paused_until`, `assigned_servant` (re-routed to `assign_person` for history logging — `update_person` rejects direct mutation of `assigned_servant`).
3. **Comments field UX**:
   - Hidden entirely if caller has no comment access (non-admin non-assigned).
   - Editable only if caller is admin or assigned servant.
   - Multiline `TextInput` (Paper) with 1000 char limit.
4. **Priority radio order**: High, Medium, Low, Very Low — left-to-right (or RTL flipped). Defaults retain existing value in edit mode; defaults to `medium` in create mode.
5. **Assigned Servant picker**: Paper `Menu` listing all active servants alphabetically. Disabled for non-admins. In create/upgrade mode, defaults to the current servant.
6. **Reassignment integration**: when admin changes `assigned_servant` in edit mode, the form calls `assign_person(personId, newServantId, reason)` instead of `update_person`. Other field changes are batched into a single `update_person` call. Reason is captured via a small "Reason" Paper TextInput inline above the picker.
7. **"Upgrade to Full" button visibility**: shown only when `registration_type === 'quick_add'` AND caller is admin or assigned servant.
8. **Soft-delete UI**: a Paper Button with destructive intent ("Remove member") below the Edit form's Save button, admin-only, opens a confirmation dialog with a typed-confirmation pattern (admin must type the person's name to enable the Confirm button). This is the _general churn_ path (PII scrub, attendance preserved); GDPR Article 17 hard-erasure is a distinct admin path introduced in `add-gdpr-compliance` (Admin Compliance screen) and must not be conflated with this soft-delete UI.

9. **Phone number is not unique**: phones may be shared across family members and are NOT enforced unique at the schema or RPC level. The Quick Add flow already runs `find_potential_duplicate` (via `add-quick-add-registration`); the Full Registration form on initial create reuses the same RPC and dialog ("Use existing" / "Save anyway"). On edit, no duplicate check runs — existing rows are not retroactively de-duplicated.

10. **Free-text member data stored as-entered**: name, region, and especially `comments` are stored verbatim. The form does not auto-translate or transliterate. A comment in Arabic typed on an English-locale phone is saved exactly as typed. Per-field bidirectional rendering relies on Paper's `TextInput` direction inference (per `add-i18n-foundation` § 10).

## Risks / Trade-offs

- **Risk**: a single form component handling three modes risks complexity. Mitigation: mode-specific submit handlers extracted to `useFullRegistrationSubmit(mode, ...)` hook; the form component itself stays presentation-only.
- **Risk**: typed-confirmation soft-delete is mildly annoying. Worth it: scrubbing is irreversible and we don't want a slipped tap to wipe data.
- **Trade-off**: not surfacing `assignment_history` in UI yet. Acceptable — admins can read it from Supabase Dashboard until phase 13.

## Migration Plan

- Migration `006_update_person_revision.sql`: replace `update_person` with the field-permission-aware version. Idempotent; no data migration.

## Open Questions

- **B1**: applied default — comments persist on reassignment, visible only to current assigned + admins (already enforced in phase 4's RPCs).
- **B2**: applied default — typed confirmation for soft-delete.
