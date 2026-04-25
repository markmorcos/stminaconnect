## Context

EN/AR/DE all have to ship from public release. Arabic adds an RTL layout requirement that touches navigation, alignment, and any directional iconography. React Native's RTL support is unusual: changing direction at runtime requires `I18nManager.forceRTL(true)` followed by an app reload — there is no way to dynamically swap layouts mid-session. This shapes the language-switcher UX (one-time reload dialog).

## Goals

- Ship EN/AR/DE from this phase forward.
- One canonical translation key system; no string interpolation in components.
- Device-locale detection on first launch; persisted manual override.
- RTL "just works" once Arabic is selected — Paper components flip automatically.
- Missing-key safety: tests catch absence; runtime falls back to the EN string with a `[MISSING]` prefix in dev.

## Non-Goals

- Server-driven translations / dynamic key fetching. All keys are bundled.
- Translation of member-entered free text (names, comments, region names). Stored as-entered.
- Bidirectional text auto-detection in single fields (Paper handles this in `TextInput`).
- Per-feature lazy-loaded translation bundles. Volume is small; ship them all eagerly.
- Locale-aware date formatting on the dashboard (deferred to phase 13).

## Decisions

0. **Font loading lives in design system**, not here. `setup-design-system` already loads Inter + IBM Plex Sans Arabic via `expo-font`. This phase's responsibility is purely language detection, persistence, switching, RTL, and translation key plumbing. The design system's `Text` component reads `i18n.language` at render and resolves `fontFamily`. Until i18n is initialized, the active language is whatever the design-system bootstrap set (defaults to `en`); first render of `Text` therefore uses Inter, which is correct for `en`/`de`.

1. **Three locales pinned**: `en`, `ar`, `de`. No `ar-EG` / `de-AT` variants in v1.
2. **Default language**: device locale via `expo-localization`. If device locale is not one of the three, default to `en`.
3. **Override persistence**: stored in AsyncStorage at key `app.lang`. Read at app boot before i18next initialization.
4. **RTL switch UX** (resolves potential UX ambiguity): when the user switches **into** Arabic from a non-RTL state, a Paper Dialog appears: "The app will restart to switch to right-to-left layout." Buttons: "Restart" (calls `I18nManager.forceRTL(true)` then `Updates.reloadAsync()`) and "Cancel". Switching out of Arabic also triggers the dialog. Same-side switches (EN ↔ DE) reload-free.
5. **Translation key shape**: `feature.context.label`. Feature is the lowercase capability name (`auth`, `registration`, `attendance`); `common.*` for cross-cutting (e.g. `common.actions.save`, `common.errors.networkOffline`).
6. **Resource typing**: enable i18next's TypeScript inference via `declare module 'i18next' { interface CustomTypeOptions ... }`. Enables editor autocompletion for keys and turns missing keys into compile errors when used with the typesafe wrapper.
7. **Plural handling**: i18next built-in. Each language declares its plural rules. Tested explicitly for Arabic (six forms).
8. **Translation file shape**: nested JSON, one file per language at `src/i18n/locales/{en,ar,de}.json`. Avoids a translator having to scroll through 1000 keys in a flat file.
9. **Missing-key handling**: in dev, falls back to the EN string prefixed with `[MISSING]` and logs a warning. In prod (post-phase 18), falls back silently to EN.
10. **Member-data direction inference**: Paper `TextInput` infers per-field text direction from the entered characters' Unicode bidirectionality. We rely on this rather than building custom direction logic. Member free text — names, comments, region — is stored as-entered, never auto-translated or transliterated. A comment in Arabic typed on an English-locale phone is saved exactly as typed.

11. **App-name localization**: the displayed app name resolves from `t('branding.appName')` per locale:
    - `en` → "St. Mina Connect"
    - `ar` → "خدمة القديس مينا" (the Arabic phrase for "Service of Saint Mina"; "Connect" doesn't translate idiomatically)
    - `de` → "St. Mina Connect" — kept English because German Coptic communities use the English transliteration in print and signage; a German rendering would feel imposed
      The native bundle name (`expo.name` in `app.json`) stays "St. Mina Connect" — this is what appears on the device home screen regardless of UI language. Final values are produced in `add-brand-assets`; this phase reserves the keys.
12. **Language switcher placement**: `app/(app)/settings/language.tsx` for now — three radio rows: English / العربية / Deutsch. Phase 13/14 folds it into a wider Settings index.

## Risks / Trade-offs

- **Risk**: the `Updates.reloadAsync()` flow in Expo Go works differently than in a dev build (Expo Go always reloads from the dev server). Mitigation: documented; the in-app dialog still triggers a reload in Expo Go via dev server reconnect.
- **Risk**: Paper components mostly handle RTL but custom layouts (icon + text rows, dashboards) need manual `start`/`end` instead of `left`/`right`. Mitigation: lint rule (custom ESLint rule or grep check in CI later) flags `marginLeft` / `marginRight` in commits.
- **Trade-off**: shipping all translations upfront in every change adds writing overhead. Worth it: solo dev cannot afford to retroactively translate later.
- **Risk**: forgetting to add a key to AR/DE files. Mitigation: the parity test fails the build.
- **Risk**: brief font-flash on first render before i18n initializes — `Text` would resolve to Inter, then to IBM Plex Sans Arabic if the active language is `ar`. Mitigation: design-system's bootstrap blocks render until both fonts are loaded AND i18n is initialized, so the first painted frame already has the correct family.

## Migration Plan

- Add `expo-localization` (already installed in phase 1).
- Add i18next initialization at app entry point — must run before any `t()` call. `app/_layout.tsx` blocks render with a Paper `ActivityIndicator` while i18n loads (instantaneous in practice; bundles are local).
- Migrate every existing string from changes 1–2 in the same commit set so CI never has untranslated commits.

## Open Questions

- None.
