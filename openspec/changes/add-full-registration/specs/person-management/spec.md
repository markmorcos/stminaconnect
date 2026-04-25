# person-management — Spec Delta

## ADDED Requirements

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
