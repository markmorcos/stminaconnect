# Tasks — add-i18n-foundation

## 1. Translation files

- [x] 1.1 Create `src/i18n/locales/en.json` with keys for: common (actions, errors), auth (signIn, callback), home (placeholder, signOut), settings (language)
- [x] 1.2 Create `src/i18n/locales/de.json` mirroring all EN keys with German translations
- [x] 1.3 Create `src/i18n/locales/ar.json` mirroring all EN keys with Arabic translations
- [x] 1.4 Sanity-check no key uses dynamic interpolation outside i18next's `{{var}}` syntax

## 2. i18next setup

- [x] 2.1 `src/i18n/index.ts`: configure i18next with the three resource bundles, `fallbackLng: 'en'`, `interpolation.escapeValue: false`
- [x] 2.2 At app boot in `app/_layout.tsx`: read `AsyncStorage['app.lang']` → if absent, derive from `Localization.getLocales()[0]?.languageCode`; clamp to `en|ar|de` (default `en`)
- [x] 2.3 Initialize i18next with the resolved language before rendering children
- [x] 2.4 Add `<I18nextProvider>` in `app/_layout.tsx`

## 3. RTL support

- [x] 3.1 At i18n initialization: compare `i18n.language === 'ar'` vs `I18nManager.isRTL`. If mismatched on **first run** (initial boot, no override yet), call `I18nManager.allowRTL(true)` + `forceRTL(true|false)` then `Updates.reloadAsync()` once; mark in AsyncStorage so reload doesn't loop.
- [x] 3.2 Add an explicit RTL bootstrapping flag in AsyncStorage at key `app.rtlBootstrapped` to prevent reload loops

## 4. Typesafe `t` wrapper

- [x] 4.1 Add `i18next.d.ts` declaring `resources` with the EN file's typed shape
- [x] 4.2 Verify `t('auth.signIn.unknownKey')` produces a TypeScript error in editor and in `npm run typecheck`

## 5. Language switcher

- [x] 5.1 `app/(app)/settings/_layout.tsx` — Stack header (built from design-system primitives)
- [x] 5.2 `app/(app)/settings/language.tsx`: three rows of design-system `Chip` (or `RadioRow`) — English / العربية / Deutsch. No Paper components used directly — only design-system wrappers. Tapping a row that requires RTL flip shows a design-system `Modal`: "Restart needed" with primary `Button` "Restart" and ghost `Button` "Cancel".
- [x] 5.3 On confirm: write `app.lang`, call `I18nManager.forceRTL(targetIsRtl)`, `Updates.reloadAsync()`
- [x] 5.4 Same-side switch (e.g. EN ↔ DE): no dialog; just `i18n.changeLanguage` and store override; design-system `Text` re-renders with the new font family
- [x] 5.5 Add a temporary "Settings" link on the home screen to navigate to `/settings/language` for testing

## 6. Migrate existing strings

- [x] 6.1 `app/(auth)/sign-in.tsx`: every label, button, error → `t('auth.signIn.*')`
- [x] 6.2 `app/(auth)/callback.tsx`: same
- [x] 6.3 `app/(app)/index.tsx`: home placeholder + sign-out button → `t('home.*')`
- [x] 6.4 Sanity grep for `>(?!{)\s*[A-Z]` in JSX to catch any remaining hardcoded literals

## 7. Tests

- [x] 7.1 `tests/i18n/keyParity.test.ts` — enumerates every key in EN; asserts AR and DE each contain that key with a non-empty string
- [x] 7.2 `tests/i18n/pluralization.test.ts` — for any plural key (none yet, but scaffold the test for future), validates the plural forms are present
- [x] 7.3 Component test: language switcher renders three options; tapping Arabic triggers the Dialog

## 8. Verification (in Expo Go)

- [x] 8.1 Boot app on a phone with German device locale → UI is in German
- [x] 8.2 Switch to Arabic via Settings → confirm dialog appears → confirm reload → UI is in Arabic and RTL
- [x] 8.3 Switch to English → reload prompt → reload → UI back in English LTR
- [x] 8.4 Switch German ↔ English → no reload prompt; switches instantly
- [x] 8.5 `make test` and `make typecheck` clean
- [x] 8.6 `openspec validate add-i18n-foundation` passes
