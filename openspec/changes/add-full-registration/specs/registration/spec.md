# registration — Spec Delta

## ADDED Requirements

### Requirement: A Full Registration form SHALL collect priority, assigned servant, and comments in addition to Quick Add fields.

The Full Registration form MUST present the five Quick Add fields plus Priority (radio: High / Medium / Low / Very Low), Assigned Servant (picker), and Comments (multiline). The form is reachable from a "Register full" home tile and from the "Upgrade to Full" affordance on a Quick Add person profile.

#### Scenario: Full Registration form has all eight fields

- **WHEN** the Full Registration screen renders for a non-admin servant
- **THEN** First name, Last name, Phone, Region, Language, Priority, Assigned Servant, Comments inputs are visible
- **AND** Priority radio is disabled (admin-only)
- **AND** Assigned Servant picker is disabled (admin-only)
- **AND** Comments is editable

#### Scenario: Admin sees all fields editable

- **WHEN** the Full Registration screen renders for an admin
- **THEN** all eight fields are editable

### Requirement: Submitting Full Registration SHALL persist with `registration_type='full'`.

`create_person` invoked from the Full form MUST set `registration_type = 'full'`. The new row is otherwise governed by the same auto-assignment rules as Quick Add (non-admin → self).

#### Scenario: Full submit creates row with full registration type

- **GIVEN** a non-admin servant submits a Full Registration
- **THEN** the new `persons` row has `registration_type = 'full'`
- **AND** `assigned_servant = caller.id`

### Requirement: A Quick Add person SHALL be upgradeable to Full Registration.

Person profiles where `registration_type = 'quick_add'` MUST display an "Upgrade to Full" button visible to the assigned servant or any admin. Tapping the button opens the Full Registration form in `upgrade` mode pre-filled with the existing fields. Submitting calls `update_person` with the new fields plus `registration_type = 'full'`.

#### Scenario: Upgrade button visible only on Quick Add rows

- **GIVEN** person P with `registration_type = 'quick_add'`
- **WHEN** the assigned servant views P's profile
- **THEN** an "Upgrade to Full" button is visible

- **GIVEN** person Q with `registration_type = 'full'`
- **WHEN** any servant views Q's profile
- **THEN** no "Upgrade to Full" button is visible

#### Scenario: Upgrade prefills and persists

- **GIVEN** person P (Quick Add) with `first_name='Mina'`
- **WHEN** the assigned servant taps "Upgrade to Full"
- **THEN** the Full form opens with `first_name='Mina'` prefilled
- **WHEN** the servant adds comments and saves
- **THEN** `update_person` is called and `registration_type = 'full'` afterward

