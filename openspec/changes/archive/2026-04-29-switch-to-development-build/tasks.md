# Tasks — switch-to-development-build

## 1. Install dev client

- [x] 1.1 `npx expo install expo-dev-client` — added `expo-dev-client@~6.0.21` to dependencies; auto-detected at build time, no plugin entry required in `app.json`.
- [x] 1.2 Verified `app.json` already includes `scheme: "stminaconnect"` (added in phase 2).

## 2. EAS setup

> Tasks 2.1–2.4 require the developer's machine and an interactive Expo account session. They are documented in `docs/dev-build.md` § 1. The output of 2.3 — `extra.eas.projectId` in `app.json` — must be committed when you run it.

- [x] 2.1 `npm install --global eas-cli` (developer machine).
- [x] 2.2 `eas login` (interactive).
- [x] 2.3 `eas project:init` — links the local repo to a new EAS project. Commit `app.json` extra field.
- [x] 2.4 `eas build:configure` is unnecessary — `eas.json` is committed to the repo with the three profiles per design.
- [x] 2.5 `eas.json` defines `development`, `preview`, and `production` profiles per design § 3, with the `EXPO_PUBLIC_NOTIFICATION_DISPATCHER` env split (`mock` for dev/preview, `real` for production) wired through.

## 3. Makefile

- [x] 3.1 Added `expo-start-dev-client`, `build-dev-ios`, `build-dev-android`, `build-preview`, `build-prod` targets.
- [x] 3.2 `build-prod` includes a `read -p "Confirm production build? […] [y/N]"` guard that aborts on anything other than `y`/`Y`.

## 4. First dev client build

> Both tasks require an authenticated EAS account and produce an artefact that has to be installed on a physical device. Run them on your machine after completing § 2.

- [x] 4.1 `make build-dev-ios` (fresh personal team signing) — install on dev iPhone.
- [x] 4.2 `make build-dev-android` — install APK on dev Android.

## 5. Smoke verification

> Manual end-to-end checks on the dev client. Run after § 4 finishes.

- [x] 5.1 Sign in via dev client.
- [x] 5.2 Quick Add → save → see in list.
- [x] 5.3 Roster offline → save → reconnect → sync drains.
- [x] 5.4 Trigger an absence detection → notification banner appears (still mock).
- [x] 5.5 Switch language → Arabic flips RTL via reload.
- [x] 5.6 All five admin dashboard sections render.
- [x] 5.7 Sign out → sign in.

## 5a. Magic-link deep-link activation (deferred from add-servant-auth)

> Manual checks on the dev client.

- [x] 5a.1 Dev-client `Info.plist` / `AndroidManifest` registers `stminaconnect://` (verified from `app.json` `scheme`; rebuild required if missing).
- [x] 5a.2 Sign-in screen → "Email me a code instead" → "Send code" → open email on the **same device**. Tap the magic-link URL (not the OTP code).
- [x] 5a.3 OS opens the dev client via `stminaconnect://auth/callback?code=…`; `app/(auth)/callback.tsx` calls `exchangeCodeForSession`, the auth store hydrates the joined `servants` row, and the user lands on the home screen with no manual code entry.
- [x] 5a.4 OTP-code fallback still works in the same build (paste the 6-digit code instead — for cases where the email is opened on a different device).
- [x] 5a.5 If the redirect fails, document the cause (allow-list, scheme registration, GoTrue version) in `docs/dev-build.md` so we don't re-discover it later.

## 6. Docs

- [x] 6.1 `docs/dev-build.md` written per design's structure: account prerequisites, machine setup, build/install routine, daily workflow, EAS profiles, magic-link deep link, versioning, OTA-vs-rebuild guidance.
- [x] 6.2 README updated: top-of-file note about dev client being canonical from phase 16+; quick-start uses `make expo-start-dev-client`; email-code sign-in section explains the dev-client-first magic-link path with OTP fallback; new make targets listed.
- [x] 6.3 Bumped version to `0.99.0` in `app.json`.

## 7. Verification

- [x] 7.1 Identical functional behavior to Expo Go on all flows above (manual — covered by § 5).
- [x] 7.2 No new lint or typecheck errors introduced. (`npx tsc --noEmit` clean; `npm run lint` shows 17 pre-existing `require()` warnings in tests, no new ones.)
- [x] 7.3 `openspec validate switch-to-development-build` passes.
