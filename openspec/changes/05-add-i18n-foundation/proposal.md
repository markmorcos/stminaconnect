## Why

Quick Add introduced a minimal i18n setup. Full Registration added more keys. Every subsequent change will add strings. Before we scale further, we need the full i18n story: language-switcher UI, RTL handling, date/number localization conventions, and complete translations for every screen built so far. This change consolidates i18n so future changes can focus on content, not infrastructure.

## What Changes

- **MODIFIED** `i18n` capability:
  - Language switcher in Settings tab (3 options: device-default + EN + AR + DE).
  - Persisted language preference (overrides device locale).
  - RTL handling: Arabic activates `I18nManager.forceRTL(true)`; UI prompts for app reload on switch.
  - `useLocalizedFormat` hooks for date, time, relative time, and number formatting via `Intl.*`.
  - Complete translation coverage for Quick Add, Full Registration, Person Detail, Comments, Login, Settings — every screen shipped so far.
  - Linting: an ESLint rule (or script) that fails if a literal user-facing string is added outside `t(...)`.
- **ADDED** `settings` capability (first bit of it):
  - Settings screen with Language section; "About" section with app version.

## Impact

- **Affected specs:** `i18n` (MODIFIED), `settings` (ADDED — minimal)
- **Affected code (preview):**
  - Mobile: `app/(tabs)/settings.tsx`, `stores/preferences.ts`, `i18n/formatters.ts`, all existing screens (swap any remaining literals for `t(...)`)
  - i18n: complete `{en,ar,de}/*.json` files for every feature so far
  - Lint: `scripts/check-hardcoded-strings.ts` or equivalent ESLint rule
- **Breaking changes:** none for users; may force minor code churn in existing screens where literals remain.
- **Migration needs:** none.
- **Depends on:** `add-quick-add-registration`, `add-full-registration`, `add-servant-auth`.
