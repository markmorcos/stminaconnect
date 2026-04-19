## ADDED Requirements

### Requirement: Quick Add is one tap from home

The authenticated home screen SHALL expose a primary "Quick Add" button positioned above the fold, tappable in a single gesture from app launch (after sign-in).

#### Scenario: Home surfaces Quick Add

- **GIVEN** an authenticated servant on the home tab
- **WHEN** they look at the screen without scrolling
- **THEN** a large "Quick Add" button is visible
- **AND** tapping it navigates to the Quick Add screen

### Requirement: Five-field form captures a newcomer

The Quick Add screen SHALL present exactly five fields (first name, last name, phone, region, language) on a single scrollable screen, with only region optional.

#### Scenario: Successful quick add

- **GIVEN** a servant on the Quick Add screen
- **WHEN** they enter `first_name = 'Maria'`, `last_name = 'Youssef'`, `phone = '+4915112345678'`, `region = 'Neuhausen'`, `language = ar`, and tap Save
- **THEN** `create_person` is called with those values plus `registration_type = 'quick_add'` and `assigned_servant_id = <current user id>`
- **AND** the RPC succeeds
- **AND** a success toast appears
- **AND** the servant is returned to the home tab

#### Scenario: Missing required field blocks submit

- **GIVEN** a servant with first_name empty but everything else valid
- **WHEN** they tap Save
- **THEN** Save does nothing
- **AND** an inline error appears under the first_name field

#### Scenario: Invalid phone blocks submit with inline error

- **GIVEN** a servant with phone `12345` (not E.164)
- **WHEN** they blur the field
- **THEN** an inline error appears under the phone field
- **AND** Save is disabled

#### Scenario: Region optional

- **GIVEN** a fully filled form except region is empty
- **WHEN** the servant taps Save
- **THEN** the person is created with `region = null`

### Requirement: Phone defaults to German country code

The phone input SHALL default the country code to `+49` (Germany) but allow overriding via an inline country picker.

#### Scenario: German local number is normalized

- **GIVEN** the phone input shows `+49` prefix by default
- **WHEN** the servant types `1511234 5678` (with space)
- **THEN** on blur, the field displays `+49 151 12345678`
- **AND** the value submitted is `+4915112345678`

### Requirement: Language defaults to app language

The language field SHALL default to the servant's current app language and SHALL present three segmented buttons (English, Arabic, German) that reflect the current selection.

#### Scenario: Language defaults on open

- **GIVEN** the app is set to Arabic
- **WHEN** the servant opens Quick Add
- **THEN** the language selector shows Arabic selected

### Requirement: Auto-assignment to initiating servant

Quick Add SHALL always set `assigned_servant_id` to the current authenticated user's id, regardless of other choices, and SHALL NOT expose an assigned-servant picker.

#### Scenario: Assignment is automatic

- **GIVEN** servant A is authenticated
- **WHEN** they submit a valid Quick Add form
- **THEN** the created person's `assigned_servant_id` equals servant A's id
- **AND** no servant-picker control is visible on the screen

### Requirement: Soft duplicate warning on phone match

If a non-archived person with the same normalized phone number already exists, the screen SHALL display a non-blocking bottom-sheet warning when the phone field is blurred, allowing the servant to view the match or continue.

#### Scenario: Existing phone surfaces a warning

- **GIVEN** a non-archived person with phone `+4915112345678` exists
- **WHEN** the servant enters the same phone in Quick Add and blurs the field
- **THEN** a bottom sheet appears with the existing person's name and two actions: "View existing" and "Continue anyway"

#### Scenario: Continue anyway submits normally

- **GIVEN** the duplicate warning is shown
- **WHEN** the servant taps "Continue anyway" and then Save
- **THEN** a new person is created with the same phone

#### Scenario: Phone match check is normalized

- **GIVEN** an existing person with `+4915112345678`
- **WHEN** a servant enters `0151 12345678` (German local format) in a new Quick Add
- **THEN** the duplicate warning still appears (normalization treats both as equivalent)

### Requirement: Submission handles network failure gracefully

A failed submission SHALL preserve form values, display an inline error banner, and expose a Retry action. No data SHALL be silently lost.

#### Scenario: Network failure shows retry banner

- **GIVEN** the servant has filled a valid form
- **WHEN** they tap Save and the network request fails
- **THEN** an inline banner appears saying "Could not save — retry?" with a Retry button
- **AND** all form values remain filled

#### Scenario: Device offline warns before submit

- **GIVEN** the device is offline (`NetInfo` reports disconnected)
- **WHEN** the servant opens Quick Add
- **THEN** an amber banner is displayed at the top of the form warning that saving will fail
- **AND** Save is still enabled — the submission will fail and produce the retry banner above

### Requirement: Quick Add UI is trilingual from day one

All user-visible text on the Quick Add flow (form, buttons, errors, duplicate warning, success toast) SHALL be available in English, Arabic, and German.

#### Scenario: Arabic Quick Add

- **GIVEN** the app is set to Arabic
- **WHEN** the servant opens Quick Add
- **THEN** every label, placeholder, button, and error message is rendered in Arabic
- **AND** the layout respects RTL (verified manually in this change; full RTL infrastructure finalized in `add-i18n-foundation`)

#### Scenario: German Quick Add

- **GIVEN** the app is set to German
- **WHEN** the servant opens Quick Add
- **THEN** all text renders in German
