## 1. Preferences store

- [ ] 1.1 Add `stores/preferences.ts` (Zustand + persist middleware + AsyncStorage) with `languagePreference: 'device' | 'en' | 'ar' | 'de'`
- [ ] 1.2 On app boot, compute effective language: preference if set, else device locale with fallback to `en`
- [ ] 1.3 Unit tests: default = `device`; switching persists; reloads restore preference

## 2. RTL handling

- [ ] 2.1 At `i18n` bootstrap, call `I18nManager.allowRTL(true)` and, if active language is `ar`, `forceRTL(true)` if not already
- [ ] 2.2 When the user switches language to or from Arabic, show a confirm dialog: "Restart required" → `Updates.reloadAsync()` (expo-updates)
- [ ] 2.3 Test manually: after restart, all screens flip layout direction

## 3. Language switcher

- [ ] 3.1 `app/(tabs)/settings.tsx`: add Language section with options (Device default, English, العربية, Deutsch)
- [ ] 3.2 Tapping an option sets the preference; if Arabic toggle changes, prompt restart
- [ ] 3.3 Tests: store updates; settings screen reflects current preference

## 4. Localized formatters

- [ ] 4.1 `i18n/formatters.ts` — `formatDate`, `formatTime`, `formatRelativeTime`, `formatNumber` all using `Intl` with active language
- [ ] 4.2 `useLocalizedDate`, `useLocalizedRelative` hooks
- [ ] 4.3 Unit tests covering each language for a date, relative time ("vor 3 Tagen"), and number (20 vs ٢٠)

## 5. Translation coverage

- [ ] 5.1 Audit every user-visible string in existing screens; create/update `locales/{en,ar,de}/{common,auth,registration,person,settings}.json`
- [ ] 5.2 Have a native-speaker reviewer verify Arabic and German translations before merge (PR checklist)
- [ ] 5.3 Verify plurals work for Arabic (i18next's `_zero`, `_one`, `_two`, `_few`, `_many`, `_other` suffixes) in at least one key that uses them (e.g., "X new members")

## 6. Lint enforcement

- [ ] 6.1 Add ESLint plugin / rule (`eslint-plugin-i18next` or custom) flagging literal JSX strings and `<Text>` children that aren't from `t(...)`
- [ ] 6.2 Allowlist legitimate literals (e.g., technical names, icon labels if any)
- [ ] 6.3 Run `make lint` and fix all violations

## 7. Verification

- [ ] 7.1 Manual: switch language 3x in each direction; confirm translation, RTL for Arabic, persistence across restart
- [ ] 7.2 Manual: Quick Add, Full Registration, Person detail all read correctly in Arabic with correct RTL layout
- [ ] 7.3 `make test`, `make lint`, `make typecheck` pass
- [ ] 7.4 `openspec validate add-i18n-foundation` passes
- [ ] 7.5 Walk every scenario in `specs/i18n/spec.md` and `specs/settings/spec.md`
