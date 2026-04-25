# i18n Specification

## Purpose

The i18n capability makes the app fully multilingual from day one across the three languages of the Munich Coptic congregation: English, Arabic, and German. It bundles all three locales eagerly, derives the initial language from the device with a persistent manual override, handles RTL via an explicit reload when toggling Arabic, and enforces a typesafe `t()` wrapper plus a Jest key-parity test so no screen ships with hardcoded or missing strings. Member-entered free text is preserved verbatim — only UI chrome is translated.

## Requirements

### Requirement: The app SHALL ship with English, Arabic, and German localizations from this phase forward.

All three locales MUST be bundled with the app. Translation bundles SHALL be loaded eagerly at app boot. From this change onward, **no user-facing string SHALL be hardcoded in any component** — all strings go through the typesafe `t()` wrapper.

#### Scenario: Three locales available

- **WHEN** the language switcher is opened
- **THEN** exactly three options are shown: English, العربية (Arabic), Deutsch (German)

#### Scenario: No hardcoded strings in migrated components

- **WHEN** a developer greps the migrated files (`app/(auth)/sign-in.tsx`, `app/(auth)/callback.tsx`, `app/(app)/index.tsx`) for English literal text
- **THEN** every visible string is wrapped in `t('...')`
- **AND** the language test suite passes

### Requirement: The default language SHALL be derived from device locale, with a persistent manual override.

On first launch, the app MUST detect the device's preferred language via `expo-localization`. If the device language is `en`, `de`, or `ar`, that becomes the active language. Otherwise the default is `en`. The user MAY override via Settings → Language; the override SHALL persist across app restarts.

#### Scenario: German device defaults to German

- **GIVEN** a fresh app install on a device with locale `de-DE`
- **AND** no override has been set
- **WHEN** the app boots
- **THEN** the active language is `de`
- **AND** the home screen text is in German

#### Scenario: Manual override persists

- **GIVEN** a German-locale device, app currently in German
- **WHEN** the user navigates to Settings → Language and selects English
- **THEN** the active language becomes `en`
- **AND** AsyncStorage key `app.lang` is set to `'en'`
- **WHEN** the user kills and reopens the app
- **THEN** the active language is still `en`

#### Scenario: Unknown device locale falls back to English

- **GIVEN** a fresh install on a device with locale `fr-FR`
- **AND** no override
- **WHEN** the app boots
- **THEN** the active language is `en`

### Requirement: Switching to or from Arabic SHALL trigger an explicit app reload.

React Native cannot toggle layout direction at runtime without a reload. When the user selects Arabic from a non-RTL state — or any non-Arabic option from an RTL state — the app SHALL display a Paper Dialog warning that a restart is required. On confirmation, the app SHALL update `I18nManager` and reload via `Updates.reloadAsync()`.

#### Scenario: Switching English → Arabic prompts and reloads

- **GIVEN** the active language is `en` and `I18nManager.isRTL` is `false`
- **WHEN** the user taps the Arabic option in the language switcher
- **THEN** a Dialog appears titled with the localized "Restart needed" message
- **WHEN** the user confirms
- **THEN** `I18nManager.forceRTL(true)` is called
- **AND** `Updates.reloadAsync()` is invoked
- **AND** after reload, the layout is RTL and all text is in Arabic

#### Scenario: Switching German → English does not require reload

- **GIVEN** the active language is `de` (LTR)
- **WHEN** the user taps the English option
- **THEN** no dialog appears
- **AND** the active language changes to `en` immediately
- **AND** the UI re-renders in English without reloading

### Requirement: All translation keys SHALL be present in every locale file.

The Jest key-parity test MUST enumerate every key in `en.json` and assert that `ar.json` and `de.json` contain the same key with a non-empty string value. Missing keys MUST fail the test. This guards against shipping screens that fall back to English when another locale is active.

#### Scenario: Missing Arabic translation fails the build

- **GIVEN** a key `auth.signIn.title` exists in `en.json` and `de.json`
- **AND** the same key is absent from `ar.json`
- **WHEN** `npm test` runs
- **THEN** the key-parity test fails with a message identifying the missing key and locale

### Requirement: Translation keys SHALL follow the `feature.context.label` convention.

Keys MUST be dot-notation, organized by feature/capability prefix. Cross-cutting strings (button labels, generic errors) live under `common.*`. This keeps locale files browseable and prevents collisions.

#### Scenario: Auth keys live under the `auth` namespace

- **WHEN** the sign-in screen calls `t('auth.signIn.title')`
- **THEN** all locale files contain a `auth.signIn.title` entry under the `auth` → `signIn` → `title` nesting

### Requirement: The `t()` wrapper SHALL produce TypeScript errors for unknown keys.

A typesafe wrapper around `useTranslation().t` MUST narrow the key type to the union of EN keys. Calling `t('does.not.exist')` MUST fail `npm run typecheck`.

#### Scenario: Unknown key fails typecheck

- **GIVEN** a component containing `t('totally.fake.key')`
- **WHEN** `npm run typecheck` runs
- **THEN** TypeScript reports a type error on that call site

### Requirement: Font family SHALL switch with active language.

The design system's `Text` component MUST resolve `fontFamily` based on `i18n.language`: Arabic uses IBM Plex Sans Arabic; all other languages use Inter. Both font families are loaded by `setup-design-system` before first render; this requirement governs the runtime resolution.

#### Scenario: Switching to Arabic re-renders all text in Arabic font

- **GIVEN** active language is `de` (Latin, Inter)
- **WHEN** the user switches to `ar` (Arabic, IBM Plex Sans Arabic) — same-side path no reload
- **THEN** all visible `Text` re-renders with `fontFamily: 'IBM Plex Sans Arabic'`

### Requirement: Member-entered free text SHALL NOT be translated.

Names, comments, region names, and any other user-entered free text MUST be stored and displayed verbatim. The app SHALL NOT auto-translate or transliterate member data. Per-field bidirectional rendering relies on Paper's `TextInput` direction inference.

#### Scenario: Arabic comment in English UI displays untranslated

- **GIVEN** the active language is `en`
- **AND** a member has a comment field containing the Arabic text "ملاحظة"
- **WHEN** the comment is rendered in any screen
- **THEN** the displayed text is exactly "ملاحظة"
- **AND** the field renders right-to-left automatically based on its content
