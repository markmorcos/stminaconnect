# person-management Specification

## Purpose

The person-management capability establishes the `persons` table as the single source of truth for member records and locks down access at the data layer before any registration UI ships. Every member — whether captured via Quick Add or Full Registration — occupies exactly one row, with RLS denying direct table access and routing all reads/writes through `SECURITY DEFINER` RPCs. Privacy is enforced at the database: the `comments` field is exposed only to the currently assigned servant and admins, with an `assignment_history` trigger making reassignment immediately re-gate visibility. Soft-delete scrubs PII while preserving referential integrity for downstream tables (attendance, follow-ups). v1 ships without member photos — profile screens display deterministically-colored initials via the design-system `Avatar` instead.

## Requirements

### Requirement: A `persons` table SHALL be the single source of truth for member records.

The `persons` table MUST contain the columns enumerated in `design.md` §Decisions. Every member, whether registered via Quick Add or Full Registration, occupies exactly one row.

The `persons` table MUST NOT contain a `photo_url` (or equivalent) column in v1. Profile photos are out of scope; profile screens display initials in deterministically-colored avatars instead.

#### Scenario: Schema is created and indexed correctly

- **GIVEN** migration `002_persons.sql` has been applied
- **WHEN** the schema is inspected
- **THEN** the `persons` table exists with all columns and constraints from the design
- **AND** indexes exist on `assigned_servant`, `region`, `status`, and a partial index for `WHERE deleted_at IS NULL`
- **AND** RLS is enabled
- **AND** no `photo_url` (or analogous) column exists on the `persons` table

### Requirement: Direct table access SHALL be denied to all client roles.

RLS policies on `persons` MUST deny SELECT, INSERT, UPDATE, and DELETE from `authenticated` and `anon` roles. All client access goes through `SECURITY DEFINER` RPCs.

#### Scenario: Direct SELECT from a signed-in servant returns nothing

- **GIVEN** a signed-in servant
- **WHEN** the client executes `select * from persons`
- **THEN** the result is empty
- **AND** Supabase returns no error (RLS-filtered, not 403)

#### Scenario: Direct INSERT is denied

- **GIVEN** a signed-in servant
- **WHEN** the client attempts `insert into persons (...) values (...)`
- **THEN** the insert is rejected with an RLS violation

### Requirement: The `comments` field SHALL be visible only to the assigned servant and admins.

The `get_person` RPC MUST include `comments` only when the caller is either an admin or the currently assigned servant. For all other callers, `comments` SHALL be null in the response. Reassignment immediately changes visibility — the previous assigned servant loses access; the new one gains it.

#### Scenario: Assigned servant sees comments

- **GIVEN** person P is assigned to servant S
- **AND** S is signed in
- **WHEN** S calls `get_person(P.id)`
- **THEN** the response includes `comments` with the actual stored value

#### Scenario: Non-assigned servant cannot see comments

- **GIVEN** person P is assigned to servant S1
- **AND** servant S2 (a different non-admin servant) is signed in
- **WHEN** S2 calls `get_person(P.id)`
- **THEN** the response's `comments` field is null
- **AND** the rest of the row is returned normally

#### Scenario: Admin always sees comments

- **GIVEN** any person P
- **AND** an admin is signed in
- **WHEN** the admin calls `get_person(P.id)`
- **THEN** the response includes `comments`

#### Scenario: Reassignment immediately changes visibility

- **GIVEN** person P assigned to servant S1, with comments visible to S1
- **WHEN** an admin calls `assign_person(P.id, S2.id, 'reassigned for region')`
- **AND** S1 calls `get_person(P.id)`
- **THEN** the response's `comments` is null
- **WHEN** S2 calls `get_person(P.id)`
- **THEN** the response's `comments` is the stored value

### Requirement: Reassignments SHALL be recorded in `assignment_history`.

A trigger on `persons.assigned_servant` MUST insert a row into `assignment_history` whenever the value changes. The row records `from_servant` (old), `to_servant` (new), `changed_by` (`auth.uid()`), and `changed_at`.

#### Scenario: Assignment change inserts history row

- **GIVEN** person P assigned to S1
- **WHEN** an admin calls `assign_person(P.id, S2.id, 'reason')`
- **THEN** a row exists in `assignment_history` with `person_id = P.id`, `from_servant = S1`, `to_servant = S2`, `changed_by = admin.id`

#### Scenario: Initial assignment creates a history row

- **GIVEN** a `create_person` call with `assigned_servant = S1`
- **WHEN** the person is created
- **THEN** an `assignment_history` row exists with `from_servant = null`, `to_servant = S1`

### Requirement: Listing persons SHALL exclude soft-deleted rows.

`list_persons` MUST filter out rows where `deleted_at IS NOT NULL`. An admin-only RPC `list_persons_including_deleted` MAY be added later for audit purposes; it is not required in this phase.

#### Scenario: Soft-deleted person disappears from list

- **GIVEN** person P exists and appears in `list_persons`
- **WHEN** an admin calls `soft_delete_person(P.id)`
- **AND** any servant calls `list_persons`
- **THEN** P is not in the response

### Requirement: Soft-delete SHALL scrub personal data while preserving the row's referential integrity.

`soft_delete_person` MUST set `deleted_at = now()`, replace `first_name` with `'Removed'`, replace `last_name` with `'Member'`, set `phone = null`, and set `comments = null`. The row itself is NOT deleted; foreign keys from `attendance` (added in phase 9) and other tables remain valid.

#### Scenario: PII is scrubbed on soft-delete

- **GIVEN** person P with `first_name='John'`, `phone='+491701234567'`, `comments='private note'`
- **WHEN** an admin calls `soft_delete_person(P.id)`
- **AND** the row is fetched directly via the SQL editor
- **THEN** `first_name='Removed'`, `last_name='Member'`, `phone=null`, `comments=null`, `deleted_at` is recent

### Requirement: Person list and profile screens SHALL render data via RPCs only.

The mobile screens `app/(app)/persons/index.tsx` and `app/(app)/persons/[id].tsx` MUST fetch data through `services/api/persons.ts`, which uses `list_persons` and `get_person` RPCs. They SHALL NOT call `supabase.from('persons')` directly.

#### Scenario: Person list renders seeded persons

- **GIVEN** the seed script has run with 20 persons
- **AND** an admin is signed in
- **WHEN** the persons list screen is opened
- **THEN** all 20 persons are displayed with name, region, priority, and assigned-servant initials

#### Scenario: Profile screen renders comments-hidden banner appropriately

- **GIVEN** a non-admin signed-in servant viewing a person not assigned to them
- **WHEN** the profile screen renders
- **THEN** the comments section displays the localized message from `t('persons.profile.commentsHidden')`
- **AND** no comment text is shown

### Requirement: Profile screens SHALL render avatars with deterministic colored initials.

The persons list and profile screens MUST use the design-system `Avatar` component to display each person's identity. The avatar's background color MUST be derived deterministically from `person.id` (via FNV-1a hash modulo 8 against `tokens.avatarPalette`). The avatar's text MUST be the first letter of `first_name` plus the first letter of `last_name` (Unicode-aware). No photo upload affordance exists in v1.

#### Scenario: Same person same color across screens

- **GIVEN** person P with id `pers-123` and name "Mariam Saad"
- **WHEN** P is rendered on the persons list and on P's profile
- **THEN** both renderings show the same background color from `tokens.avatarPalette`
- **AND** both show the initials "MS" (or the Arabic-character equivalent if names use Arabic)

#### Scenario: No photo upload UI exists

- **WHEN** a reviewer inspects the persons list, profile, edit, or registration screens
- **THEN** no "Upload photo", "Take photo", or "Edit photo" affordance exists
- **AND** the design-system `Avatar` is the only avatar primitive in use

### Requirement: Phone numbers SHALL not be enforced as unique.

Family-shared phone numbers are common. The schema MUST NOT have a unique constraint on `phone`. Soft duplicate detection at registration time is a future-phase concern.

#### Scenario: Two persons can share a phone number

- **GIVEN** person P1 with phone `+491701234567` exists
- **WHEN** `create_person` is called with another person P2 also using `+491701234567`
- **THEN** the call succeeds and both rows exist

### Requirement: A profile edit screen SHALL allow editing of fields permitted to the caller.

The profile edit screen at `app/(app)/persons/[id]/edit.tsx` MUST render the same form as Full Registration in `edit` mode. The server-side `update_person` RPC MUST enforce field-level permissions; the UI SHALL mirror those rules by disabling forbidden fields. Attempts to submit forbidden field changes MUST surface a localized error.

#### Scenario: Servant edits comments on assigned person successfully

- **GIVEN** servant S is assigned to person P
- **WHEN** S edits P's comments to "Spoke after liturgy" and saves
- **THEN** `update_person` succeeds
- **AND** the profile screen displays the updated comments after navigation back

#### Scenario: Servant cannot change priority

- **GIVEN** servant S (non-admin) viewing the edit screen for any person
- **THEN** the Priority radio is disabled
- **WHEN** S attempts to bypass the UI by submitting a payload with `priority='high'`
- **THEN** `update_person` rejects with an error
- **AND** the form surfaces the localized "You don't have permission to change priority" message

#### Scenario: Servant cannot edit comments on non-assigned person

- **GIVEN** servant S not assigned to person P, and not admin
- **WHEN** S opens the edit screen for P
- **THEN** the Comments field is not visible

### Requirement: Reassignment SHALL go through `assign_person` and produce a history record.

When an admin changes the Assigned Servant in edit mode, the form MUST invoke `assign_person(personId, newServantId, reason)`. The form MUST require a non-empty Reason field whenever Assigned Servant is changed. The trigger on `persons.assigned_servant` MUST write to `assignment_history`.

#### Scenario: Admin reassigns with reason

- **GIVEN** admin A on person P's edit screen, P currently assigned to S1
- **WHEN** A selects S2 and types reason "Region change"
- **AND** A taps Save
- **THEN** `assign_person(P.id, S2.id, 'Region change')` is called
- **AND** the `persons` row's `assigned_servant` is now S2
- **AND** an `assignment_history` row exists with `from_servant=S1`, `to_servant=S2`, `reason='Region change'`

#### Scenario: Reassignment without reason is rejected

- **GIVEN** admin A on person P's edit screen
- **WHEN** A changes the Assigned Servant picker but leaves Reason blank
- **AND** taps Save
- **THEN** the form surfaces an inline error on the Reason field
- **AND** no RPC is called

### Requirement: Admins SHALL be able to soft-delete a member with typed confirmation.

Admin profiles MUST display a "Remove member" destructive button. Tapping it opens a Paper Dialog requiring the admin to type the member's full name to enable the Confirm action. On confirmation, `soft_delete_person` MUST be called and the user MUST be navigated back to the persons list.

This soft-delete is the general-churn path (PII scrub, attendance preserved). It MUST be visually and semantically distinct from the GDPR Article 17 hard-erasure path introduced in `add-gdpr-compliance`.

#### Scenario: Typed-confirmation gates removal

- **GIVEN** admin A viewing person "Mina Boutros"'s profile
- **WHEN** A taps "Remove member"
- **THEN** a dialog appears prompting "Type 'Mina Boutros' to confirm"
- **AND** the Confirm button is disabled
- **WHEN** A types "Mina Boutros" exactly
- **THEN** the Confirm button becomes enabled

#### Scenario: Confirmed removal scrubs PII

- **GIVEN** the dialog is confirmed
- **WHEN** `soft_delete_person` returns success
- **THEN** the user is navigated to the persons list
- **AND** the person no longer appears in the list
- **AND** querying the row directly shows `first_name='Removed'`, `last_name='Member'`, `phone=null`, `comments=null`, `deleted_at` recent
