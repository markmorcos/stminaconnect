# Tasks — switch-to-development-build

## 1. Install dev client

- [ ] 1.1 `npx expo install expo-dev-client`
- [ ] 1.2 Verify `app.json` includes `scheme: "stminaconnect"` (added in phase 2; should already be present).

## 2. EAS setup

- [ ] 2.1 `npm install --global eas-cli` (documented for the developer machine).
- [ ] 2.2 `eas login` (manual — interactive).
- [ ] 2.3 `eas project:init` — links the local repo to a new EAS project. Commit `app.json` extra field.
- [ ] 2.4 `eas build:configure` — generates `eas.json`.
- [ ] 2.5 Edit `eas.json` to define the three profiles per design.

## 3. Makefile

- [ ] 3.1 Add `expo-start-dev-client`, `build-dev-ios`, `build-dev-android`, `build-preview`, `build-prod` targets.
- [ ] 3.2 `build-prod` includes a `read -p "Confirm production build? [y/N]"` guard.

## 4. First dev client build

- [ ] 4.1 `make build-dev-ios` (fresh personal team signing) — install on dev iPhone.
- [ ] 4.2 `make build-dev-android` — install APK on dev Android.

## 5. Smoke verification

- [ ] 5.1 Sign in via dev client.
- [ ] 5.2 Quick Add → save → see in list.
- [ ] 5.3 Roster offline → save → reconnect → sync drains.
- [ ] 5.4 Trigger an absence detection → notification banner appears (still mock).
- [ ] 5.5 Switch language → Arabic flips RTL via reload.
- [ ] 5.6 All five admin dashboard sections render.
- [ ] 5.7 Sign out → sign in.

## 5a. Magic-link deep-link activation (deferred from add-servant-auth)

- [ ] 5a.1 Dev-client `Info.plist` / `AndroidManifest` registers `stminaconnect://` (verified from `app.json` `scheme`; rebuild required if missing).
- [ ] 5a.2 Sign-in screen → "Email me a code instead" → "Send code" → open email on the **same device**. Tap the magic-link URL (not the OTP code).
- [ ] 5a.3 OS opens the dev client via `stminaconnect://auth/callback?code=…`; `app/(auth)/callback.tsx` calls `exchangeCodeForSession`, the auth store hydrates the joined `servants` row, and the user lands on the home screen with no manual code entry.
- [ ] 5a.4 OTP-code fallback still works in the same build (paste the 6-digit code instead — for cases where the email is opened on a different device).
- [ ] 5a.5 If the redirect fails, document the cause (allow-list, scheme registration, GoTrue version) in `docs/dev-build.md` so we don't re-discover it later.

## 6. Docs

- [ ] 6.1 `docs/dev-build.md` per design's structure.
- [ ] 6.2 README updated: dev workflow uses dev client; Expo Go is legacy.
- [ ] 6.3 Bump version to `0.99.0` in `app.json`.

## 7. Verification

- [ ] 7.1 Identical functional behavior to Expo Go on all flows above.
- [ ] 7.2 No new lint or typecheck errors introduced.
- [ ] 7.3 `openspec validate switch-to-development-build` passes.
