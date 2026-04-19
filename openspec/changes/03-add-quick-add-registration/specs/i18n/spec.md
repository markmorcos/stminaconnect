## ADDED Requirements

### Requirement: i18next bootstrap

The mobile app SHALL initialize `i18next` with `react-i18next` at app launch, reading the device locale, falling back to `en`, and exposing the `t` hook to screens.

#### Scenario: Initialization

- **GIVEN** the app launches on a device with locale `ar-EG`
- **WHEN** the i18n module loads
- **THEN** `i18n.language` is `ar`
- **AND** any call to `t('common.save')` returns the Arabic translation

#### Scenario: Unknown locale falls back to English

- **GIVEN** the device locale is `fr-FR` (not a supported language)
- **WHEN** the app launches
- **THEN** `i18n.language` is `en`

### Requirement: Translation files are per-feature

Translation JSON files SHALL be organized per feature (`registration.json`, `common.json`, etc.) rather than a single monolith file, to keep ownership clear as the app grows.

#### Scenario: Feature translation lookup

- **GIVEN** the Quick Add screen uses key `registration.quick-add.save-button`
- **WHEN** rendering
- **THEN** the key resolves via the `registration` namespace loaded from `src/i18n/locales/<lang>/registration.json`

### Requirement: Missing-key behavior in dev

When a translation key is missing from the active language, the app SHALL fall back to English and SHALL log a warning to the developer console in development builds.

#### Scenario: Missing key warning

- **GIVEN** the app is in dev mode and Arabic is active
- **WHEN** `t('registration.quick-add.new-field')` is called but the key is not in `registration.json`
- **THEN** the English value is shown
- **AND** a dev-console warning names the missing key and language

*Note: the broader i18n story (language switcher UI, RTL app-wide, full translations for every screen) is finalized in `add-i18n-foundation`. This change introduces only the minimum needed for Quick Add to ship trilingual.*
