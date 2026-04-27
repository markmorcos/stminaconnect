# registration — Spec Delta

This delta is introduced by `add-absence-detection`. The Full
Registration form's Assigned Servant picker previously showed the
placeholder when the bound `assigned_servant` value was not present
in `listServants`'s result (deactivated servant, RLS-empty result for
non-admins, transient race during initial render). The picker now
always synthesizes an option for the current value so it never
appears blank.

## MODIFIED Requirements

### Requirement: A Full Registration form SHALL collect priority, assigned servant, and comments in addition to Quick Add fields.

The Full Registration form MUST present the five Quick Add fields plus
Priority (radio: High / Medium / Low / Very Low), Assigned Servant
(picker), and Comments (multiline). The form is reachable from a
"Register full" home tile and from the "Upgrade to Full" affordance
on a Quick Add person profile.

The Assigned Servant picker MUST always include a selectable option
for the form's current `assigned_servant` value, even when that value
is not in `listServants`'s result. Specifically:

- For non-admin callers (where `listServants` returns nothing because
  RLS blocks reads of other servants), the picker MUST contain a
  single option using the bound value labeled "Currently assigned"
  (in edit / upgrade modes) or the caller's display name (in create
  mode).
- For admin callers, the picker MUST start from `listServants`'s
  active-servants result and append a synthetic option for the bound
  `assigned_servant` if it is missing (e.g., the assigned servant has
  since been deactivated).
- The caller's own id MUST always be appended if it isn't already in
  the list, so admins can reassign to themselves without an extra
  fetch.

#### Scenario: Full Registration form has all eight fields

- **WHEN** the Full Registration screen renders for a non-admin servant
- **THEN** First name, Last name, Phone, Region, Language, Priority,
  Assigned Servant, Comments inputs are visible
- **AND** Priority radio is disabled (admin-only)
- **AND** Assigned Servant picker is disabled (admin-only)
- **AND** Comments is editable

#### Scenario: Admin sees all fields editable

- **WHEN** the Full Registration screen renders for an admin
- **THEN** all eight fields are editable

#### Scenario: Picker shows current value when admin's list excludes it

- **GIVEN** an admin opens the edit screen for person P assigned to
  servant S
- **AND** S is deactivated server-side (`servants.deactivated_at IS NOT NULL`)
- **AND** `listServants` therefore does NOT return S
- **WHEN** the form renders
- **THEN** the Assigned Servant picker's trigger displays the label
  for S (synthesized from the bound value), not the placeholder
- **AND** S is selectable in the dropdown
- **AND** the admin's own row is also selectable in the dropdown so
  they can reassign to themselves

#### Scenario: Non-admin picker shows "Currently assigned"

- **GIVEN** a non-admin servant opens the edit screen for a person
  they are assigned to
- **WHEN** the form renders
- **THEN** the picker is disabled
- **AND** its trigger displays the localized "Currently assigned"
  label rather than the placeholder
