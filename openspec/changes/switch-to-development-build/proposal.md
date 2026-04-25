## Why

Phases 1–15 deliver a fully-functional, fully-polished app running in Expo Go. To reach production we now need (a) real push notifications and (b) signed builds — both require leaving Expo Go behind. This change is purely tooling: introduce `expo-dev-client`, configure EAS, and document the new dev workflow. **No functional changes** in this change. After it lands, all subsequent development happens in dev clients built via EAS.

## What Changes

- **MODIFIED** capability `dev-tooling` — adds dev-build path.
- **ADDED** `expo-dev-client` dependency and `app.json` config required for it.
- **ADDED** `eas.json` with three build profiles:
  - `development` — internal distribution, dev client included.
  - `preview` — internal distribution, production-like.
  - `production` — store-ready iOS .ipa and Android .aab.
- **ADDED** EAS project linkage (`eas project:init`) committed to repo.
- **ADDED** Makefile targets:
  - `make expo-start-dev-client` — `npx expo start --dev-client`.
  - `make build-dev-ios` — `eas build --profile development --platform ios`.
  - `make build-dev-android` — `eas build --profile development --platform android`.
  - `make build-preview` — `eas build --profile preview --platform all`.
  - `make build-prod` — `eas build --profile production --platform all` (gated on confirmation prompt).
- **ADDED** Documentation `docs/dev-build.md`:
  - Account setup (Expo + Apple Developer + Google Play Console basics).
  - Building and installing the dev client on your phone.
  - Daily workflow: `make expo-start-dev-client` instead of `make expo-start`.
- **MODIFIED** `app.json`: scheme already declared (phase 2) — verified; `runtimeVersion` policy stays `sdkVersion`.
- **REMOVED** all "Expo Go-first" disclaimers in README, replaced with "Built and run via dev client".
- **ADDED** A first dev client build of each platform produced and verified to install via QR + sign in + perform a complete flow that matches Expo Go behavior identically.

## Impact

- **Affected specs**: `dev-tooling` (modified — adds dev-build path).
- **Affected code**: `eas.json` (new), `app.json` (touched), `Makefile`, `package.json` (`expo-dev-client` dep), README + new `docs/dev-build.md`.
- **Breaking changes**: developer workflow changes — `make expo-start` is no longer the canonical command for daily work. Old Expo Go flow still works for read-only screens but is not officially supported.
- **Migration needs**: developers must build a dev client once.
- **Expo Go compatible**: this change INTRODUCES the post-Expo-Go workflow. After this change, **subsequent changes (17, 18) are NOT bound by Expo Go compatibility.**
- **Dependencies**: `harden-and-polish`.
