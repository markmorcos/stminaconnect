## ADDED Requirements

### Requirement: In-app language switcher

The Settings tab SHALL expose a Language section listing `Device default`, `English`, `العربية`, and `Deutsch`. Selecting an option SHALL update the active language and persist the choice.

#### Scenario: Switch to German

- **GIVEN** the app is in English
- **WHEN** the user taps Settings → Language → `Deutsch`
- **THEN** all visible text re-renders in German within the same screen without a restart
- **AND** the preference is persisted

#### Scenario: Switch back to device default

- **GIVEN** the preference is set to `Deutsch` and the device locale is `en-US`
- **WHEN** the user selects `Device default`
- **THEN** the app switches to English

### Requirement: Arabic toggles RTL with prompted reload

Selecting Arabic, or leaving Arabic for another language, SHALL prompt the user with "Restart required — restart now?" and, on confirmation, reload the app via `Updates.reloadAsync`. The `I18nManager` direction SHALL match the selected language after reload.

#### Scenario: Switch to Arabic

- **GIVEN** the app is in English
- **WHEN** the user selects `العربية`
- **THEN** a dialog appears: "Restart required — restart now?" with Cancel / Restart buttons
- **AND** tapping Restart reloads the app
- **AND** after reload, `I18nManager.isRTL` is `true` and every screen renders mirrored (text right-aligned, nav buttons mirrored)

#### Scenario: Leaving Arabic also prompts reload

- **GIVEN** the app is in Arabic (RTL)
- **WHEN** the user selects `English`
- **THEN** the restart prompt appears
- **AND** after reload, `I18nManager.isRTL` is `false`

### Requirement: Localized date, time, relative time, and number formatting

The app SHALL provide `formatDate`, `formatTime`, `formatRelativeTime`, and `formatNumber` utilities backed by `Intl.*`, using the active language. Screens SHALL NOT format dates or numbers manually.

#### Scenario: Relative time in each language

- **GIVEN** a timestamp 3 days ago
- **WHEN** `formatRelativeTime(ts)` is called with active language:
  - `en`: returns `"3 days ago"`
  - `de`: returns `"vor 3 Tagen"`
  - `ar`: returns `"قبل ٣ أيام"`

#### Scenario: Date in each language

- **GIVEN** the date `2026-04-19` and active language
- **WHEN** `formatDate(date, 'medium')` is called:
  - `en`: `"Apr 19, 2026"`
  - `de`: `"19. Apr. 2026"`
  - `ar`: uses the `ar` locale's medium format

### Requirement: No literal user-facing strings in source

Lint SHALL fail if a PR introduces a user-visible literal string that is not routed through `t(...)`. Technical constants, icon names, and explicitly allowlisted identifiers are exempt.

#### Scenario: Lint catches a literal

- **GIVEN** a developer writes `<Text>Save</Text>` in a new screen
- **WHEN** `make lint` runs
- **THEN** ESLint reports the literal as a violation
- **AND** the commit is rejected by the pre-commit hook

#### Scenario: Lint accepts an allowlisted literal

- **GIVEN** a developer writes `<Icon name="chevron-right" />`
- **WHEN** `make lint` runs
- **THEN** no violation is reported (icon name matches allowlist)

### Requirement: Complete translation coverage for shipped screens

At the completion of this change, every user-visible string on Login, Quick Add, Full Registration, Person Detail (all tabs), Home, and Settings SHALL be present in all three locales.

#### Scenario: Arabic coverage check

- **GIVEN** the app is set to Arabic
- **WHEN** the developer navigates through every shipped screen
- **THEN** no English fallback text appears
- **AND** the dev-console emits no missing-key warnings

#### Scenario: German coverage check

- **GIVEN** the app is set to German
- **WHEN** the developer navigates through every shipped screen
- **THEN** no English fallback text appears
