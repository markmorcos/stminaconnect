# registration — Spec Delta

## ADDED Requirements

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

### Requirement: The form's labels SHALL be switchable to the newcomer's language without affecting the rest of the app.

When the newcomer taps a Language radio (English / العربية / Deutsch), the form's labels and helper texts MUST re-render in that language. The app's overall language MUST NOT change. Other screens, the home tile, and the Snackbar messages remain in the active app language.

#### Scenario: Switching form language to Arabic translates labels only

- **GIVEN** the active app language is English
- **AND** the Quick Add form is open
- **WHEN** the user taps the Arabic radio
- **THEN** the field labels (First name, Last name, Phone, Region, Language) re-render in Arabic
- **AND** the screen's Stack header (translated via app i18n) remains in English
- **WHEN** the user navigates back to home
- **THEN** the home screen is in English
- **AND** the global app language is still English

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
