# registration Specification

## Purpose

The registration capability covers the on-boarding flows that turn a newcomer into a `persons` row. v1 ships **Quick Add** only — a deliberately brief, forgiving 5-field flow surfaced as a primary CTA on the authenticated home screen. The flow is built for Sunday-morning use: a servant meets a newcomer, hands the phone over, and within three taps the newcomer is "Saved!". Quick Add auto-assigns the new person to the initiating servant, defaults phone numbers to the German country code, captures the newcomer's preferred language for future contact (without retranslating the form the servant is reading), and warns — but does not block — on soft duplicates. Full Registration lands in a later phase.

## Requirements

### Requirement: A "Quick Add" CTA SHALL be reachable in one tap from the authenticated home screen.

The home screen MUST display a primary tile labelled with `t('home.quickAdd')` that navigates to the Quick Add screen. The tile MUST be the largest, most-prominent action on the home screen.

#### Scenario: Quick Add CTA visible on home

- **GIVEN** a signed-in servant
- **WHEN** the home screen renders
- **THEN** a "Quick Add" tile is visible above all other actions
- **AND** tapping it navigates to `/registration/quick-add`

### Requirement: The Quick Add form SHALL collect exactly five fields.

The Quick Add screen MUST present exactly five inputs: First name, Last name, Phone, Region, Language. No other fields are visible. Priority, comments, assigned servant, registration type, and status are not exposed to the user; they are set server-side or to defaults.

#### Scenario: Form has five visible inputs

- **WHEN** the Quick Add screen renders
- **THEN** the visible form contains First name, Last name, Phone, Region, Language inputs
- **AND** no other input is visible

### Requirement: Phone numbers SHALL be E.164-validated and default to +49.

The phone field MUST prefill with `+49 ` (with cursor positioned after the space). Submitted values MUST match the pattern `+\d{9,15}` after stripping internal whitespace. Invalid values MUST surface an inline error.

#### Scenario: Default phone prefix

- **WHEN** the Quick Add screen renders
- **THEN** the phone field's value is `+49 `

#### Scenario: Invalid phone fails validation

- **GIVEN** the form is filled with valid name fields
- **WHEN** the phone field contains `0170 1234567` (no `+` prefix)
- **AND** the user taps Save
- **THEN** the form does not submit
- **AND** an inline error appears below the phone field reading the localized "Invalid phone number" message

#### Scenario: Valid international phone accepted

- **GIVEN** valid name fields
- **AND** phone field contains `+201001234567`
- **WHEN** the user taps Save
- **THEN** validation passes
- **AND** the form submits

### Requirement: The Language radio SHALL capture the newcomer's preferred language for storage only.

The Language radio MUST set the `language` field on the created `persons` row. It MUST NOT retranslate the form. The servant operates the device, so form labels and helper texts always render in the active app language; switching the radio only records the newcomer's preference for future contact.

#### Scenario: Tapping a different language radio does not change form labels

- **GIVEN** the active app language is English
- **AND** the Quick Add form is open
- **WHEN** the user taps the Arabic radio
- **THEN** the field labels (First name, Last name, Phone, Region, Language) remain in English
- **AND** the radio reflects "Arabic" as the selected option

#### Scenario: Selected language persists on the saved row

- **GIVEN** the form is filled with valid values
- **AND** the user has tapped the Arabic radio
- **WHEN** the user taps Save and the create succeeds
- **THEN** the `persons` row has `language = 'ar'`

### Requirement: Quick Add SHALL auto-assign the new person to the initiating servant.

`create_person` MUST set `assigned_servant = auth.uid()` for non-admin callers, regardless of any value in the payload. The new row's `registered_by`, `registered_at`, and `assigned_servant` SHALL all reflect the caller. `registration_type` MUST be `'quick_add'`. `priority` defaults to `'medium'`. `status` defaults to `'new'`.

#### Scenario: Non-admin servant Quick Add auto-assigns to self

- **GIVEN** servant S1 (non-admin) is signed in
- **WHEN** S1 submits a valid Quick Add form
- **THEN** the resulting `persons` row has `assigned_servant = S1.id`
- **AND** `registered_by = S1.id`
- **AND** `registration_type = 'quick_add'`
- **AND** `priority = 'medium'`
- **AND** `status = 'new'`

#### Scenario: Admin Quick Add accepts an explicit assigned_servant

- **GIVEN** admin A is signed in
- **WHEN** A submits a Quick Add with payload including `assigned_servant = S2.id`
- **THEN** the resulting `persons` row has `assigned_servant = S2.id`

### Requirement: Soft duplicate detection SHALL warn but not block.

Before submitting `create_person`, the form MUST call `find_potential_duplicate(first, last, phone)`. If the RPC returns a non-null `persons.id`, a Paper Dialog SHALL appear with the existing person's name and offer two actions: "Use existing" (navigates to that profile) and "Save anyway" (proceeds with the create). If the RPC returns null, the create proceeds without prompt.

#### Scenario: Exact duplicate triggers dialog

- **GIVEN** an existing person with `first_name='Mina'`, `last_name='Boutros'`, `phone='+491701234567'`
- **WHEN** a servant submits Quick Add with the same three values
- **THEN** the duplicate dialog appears showing "Mina Boutros"
- **AND** no `persons` row is yet created

#### Scenario: "Save anyway" creates a duplicate

- **GIVEN** the duplicate dialog is open
- **WHEN** the user taps "Save anyway"
- **THEN** a new `persons` row is created
- **AND** the database now contains two rows with the same name and phone

#### Scenario: "Use existing" navigates without creating

- **GIVEN** the duplicate dialog is open
- **WHEN** the user taps "Use existing"
- **THEN** no new `persons` row is created
- **AND** the user is navigated to `/persons/[existing-id]`

### Requirement: Successful save SHALL navigate home with a localized success message.

On successful `create_person`, the user MUST be navigated back to the home screen. A Paper Snackbar MUST display "Welcome [first name]!" using `t('registration.quickAdd.successWelcome', { firstName })` in the **active app language** (not the form-local language).

#### Scenario: Success snackbar in app language

- **GIVEN** the active app language is German
- **AND** the form-local language is Arabic
- **AND** the user submits with first name "Mariam"
- **THEN** the user is navigated to home
- **AND** a snackbar appears reading the German rendering of "Welcome Mariam!"

### Requirement: The submit button SHALL show a loading state while saving.

The Save button MUST be disabled and display a loading indicator from the moment of submit until either success navigation or error surface. Double-submission MUST be prevented.

#### Scenario: Disabled button during in-flight save

- **GIVEN** a valid, complete Quick Add form
- **WHEN** the user taps Save
- **AND** the request is in-flight
- **THEN** the Save button is disabled
- **AND** a Paper `ActivityIndicator` is visible on the button
- **WHEN** the user taps the button area again
- **THEN** no second request is sent

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
