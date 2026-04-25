## Why

The app's audience speaks English, Arabic, and German — splitting roughly thirds. Retrofitting i18n after building screens in English-only is painful (every label, every plural, every layout direction needs revisiting). We do this now, before any feature screens are built, so every label written from this point forward goes in via `t()` from day one.

## What Changes

- **ADDED** capability `i18n`.
- **ADDED** i18next + react-i18next configured with EN/AR/DE bundles.
- **ADDED** `expo-localization` to detect device language; default to detected language unless an override is stored.
- **ADDED** RTL support via React Native's `I18nManager`. First switch to Arabic shows a one-time "App will reload" dialog, then forces RTL and reloads.
- **ADDED** Manual language switcher in a temporary `app/(app)/settings/language.tsx` screen (will be folded into a fuller settings screen in phase 13/14).
- **ADDED** Translation key infrastructure: feature-prefixed dot-notation keys (`auth.signIn.title`, `common.actions.save`, etc.).
- **ADDED** Translation files for all keys introduced in changes 1–2 (sign-in, callback, home placeholder, sign-out button, error messages).
- **ADDED** A typesafe `t()` wrapper exporting the union of valid keys (via `i18next` resource typing).
- **ADDED** Test rule: a Jest test enumerates EN keys and asserts AR and DE files contain them all (catches missing translations at CI time).
- **MODIFIED** All previously hardcoded strings from changes 1–2 are migrated to `t()` calls.

## Impact

- **Affected specs**: `i18n` (new). `auth` is touched only for string migration; no behavior change.
- **Affected code**: `src/i18n/*`, `app/(auth)/sign-in.tsx`, `app/(auth)/callback.tsx`, `app/(app)/index.tsx`, plus a new `app/(app)/settings/language.tsx`.
- **Breaking changes**: none — runtime-visible behavior is identical when device locale is `en`.
- **Migration needs**: none — translations are static files.
- **Expo Go compatible**: yes — i18next, react-i18next, expo-localization, and `I18nManager` all work in Expo Go.
- **Uses design system**: yes — language switcher, dialogs, and any new UI consume design system tokens and components from `setup-design-system`. The font-family resolver in design system's `Text` component reads `i18n.language` and switches to IBM Plex Sans Arabic for `ar`; the Latin/Arabic font loading happens in `setup-design-system`.
- **Dependencies**: `init-project-scaffolding`, `setup-design-system`, `add-brand-assets`, `add-servant-auth`.
