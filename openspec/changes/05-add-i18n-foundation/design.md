## Context

i18next has been set up minimally. Two things push us to formalize now: (1) RTL is non-trivial on React Native and requires an app reload after toggling, so we want to nail it before more screens are built; (2) unless we enforce "no literal strings outside `t()`", drift is inevitable.

## Goals

- Users can change language in-app; persisted across launches.
- Arabic renders fully right-to-left after a prompted reload.
- Dates and numbers always use the active locale's conventions.
- No literal user-facing string slips into the codebase unnoticed.

## Non-Goals

- No dynamic language switching without reload. RN's `I18nManager` changes require a reload to fully apply. We document this and prompt the user — industry-standard approach.
- No third-party translation service integration (Crowdin, Lokalise). Translations are managed via PR review in this repo. Revisit if translator workload grows.
- No per-user language preference on the server (it lives on the device). A user on two devices may have different app languages; acceptable.

## Decisions

1. **Persisted preference in Zustand + AsyncStorage.** Key `user.language-preference`, values `'device' | 'en' | 'ar' | 'de'`. Zustand's `persist` middleware with AsyncStorage as the storage.

2. **RTL reload flow**: when switching to/from Arabic, show a dialog: "Arabic requires the app to restart. Restart now?" → `Updates.reloadAsync()`. Switching between EN↔DE does not require a reload.

3. **Lint enforcement via ESLint rule `i18next/no-literal-string`.** Configure it with allowlists (empty strings, technical identifiers, `import` paths). Runs on every PR via `make lint`.

4. **`useLocalizedDate(value, style)` hook** wrapping `Intl.DateTimeFormat`. Do not use any date library (no moment, no dayjs) — `Intl` is built in and all supported locales are covered natively.

5. **Namespace per feature is the convention.** `common`, `auth`, `registration`, `person`, `settings`, and so on as features land.

6. **Arabic font**: iOS and Android both have acceptable default Arabic fonts. We don't ship custom fonts in v1 unless visual QA demands it.

7. **Number and currency**: no currency in v1 (church is not a payment app). Number formatting only for counts in dashboards (e.g., "٢٠ عضو" in Arabic).

## Risks / Trade-offs

- **Risk:** The `no-literal-string` rule is noisy and has false positives. Mitigated by a well-tuned allowlist and an occasional `// eslint-disable-next-line i18next/no-literal-string` comment for technical constants.
- **Trade-off:** Requiring a reload for Arabic is a small UX bump; we judge it acceptable vs. the engineering cost of hot RTL switching.
- **Trade-off:** Translations are a PR-review bottleneck. If we grow past a single translator per language, we'll need tooling (out of v1 scope).

## Open Questions

None blocking.
