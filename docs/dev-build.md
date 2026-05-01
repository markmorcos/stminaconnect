# Development build (post-Expo-Go workflow)

From phase 16 onward, daily development happens in a **custom dev client** built via EAS rather than the public Expo Go app. This unlocks native modules (push notifications, custom URL schemes, etc.) while keeping the OTA/QR-style live-reload loop you know from Expo Go.

This doc walks through the one-time setup, the daily workflow, and the per-platform install/refresh routine.

---

## 0. Account prerequisites (one-time, per developer)

| Account                                 | Purpose                                  | Required?                                                                             |
| --------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------- |
| **Expo** ([expo.dev](https://expo.dev)) | EAS build queue, OTA updates             | Yes                                                                                   |
| **Apple Developer Program** ($99/year)  | Signed iOS dev/preview/production builds | Yes for iOS production; **No** for personal-team dev builds (limited to 7-day expiry) |
| **Google Play Console** ($25 one-time)  | Production .aab submission               | Yes for Android production; **No** for internal APK distribution                      |

The free Apple personal team is enough to bring a dev client onto your own iPhone for daily work. Profiles expire after 7 days — re-install via QR/URL when they do. Paid Apple Developer enrolment is the v1 release gate.

## 1. One-time machine setup

```bash
# Install the EAS CLI globally.
npm install --global eas-cli

# Sign in (interactive — uses your Expo account).
eas login

# Link this repository to a new EAS project. This writes
# `extra.eas.projectId` into app.json — commit that change.
eas project:init
```

`eas build:configure` is **not** required — `eas.json` is committed to the repo with three profiles (`development`, `preview`, `production`).

## 2. Build and install the dev client

iOS:

```bash
make build-dev-ios
```

Android:

```bash
make build-dev-android
```

Each command queues a build on EAS (10–30 minutes on the free tier). When it finishes, EAS gives you a URL or QR code:

- **iOS**: open the URL on the device → "Install" (Safari prompts). The first time, you'll need to trust the personal team in _Settings → General → VPN & Device Management_.
- **Android**: download the `.apk` → install. You may need to enable "Install unknown apps" for your browser.

Re-run `make build-dev-ios` when:

- You add or remove a native module (anything tagged "config plugin" or with a custom `Info.plist` / `AndroidManifest.xml` requirement).
- The Apple personal-team provisioning expires (every 7 days on free tier).
- You bump the Expo SDK.

Otherwise the dev client picks up your JS changes via the dev server — no rebuild needed.

## 3. Daily workflow

Replace `make expo-start` with:

```bash
make expo-start-dev-client
```

Then open the dev client app on your device. It scans the same network for the dev server and hot-reloads exactly like Expo Go.

`make expo-start` (without `-dev-client`) still works for emergency Expo Go runs, but Expo Go is no longer the supported flow — anything that needs custom URL schemes, push notifications, or any native module added post-phase-16 will be missing.

## 4. EAS profiles

Configured in `eas.json`:

| Profile       | Distribution | Dev client | `EXPO_PUBLIC_NOTIFICATION_DISPATCHER` | Used for                             |
| ------------- | ------------ | ---------- | ------------------------------------- | ------------------------------------ |
| `development` | internal     | yes        | `mock`                                | Daily development                    |
| `preview`     | internal     | no         | `mock`                                | Stakeholder previews on real devices |
| `production`  | store        | no         | `real`                                | TestFlight / Play / store submission |

`make build-prod` is gated by an interactive confirmation prompt to avoid accidentally consuming production build minutes during day-to-day work.

## 5. Magic-link deep link (`stminaconnect://auth/callback`)

The custom URL scheme `stminaconnect` is registered in `app.json` and is wired through to the dev client by EAS. The magic-link flow is the **only** sign-in path:

1. Sign-in screen → enter email → "Send magic link".
2. Open the email **on the same device** as the dev client.
3. Tap the link (the URL starting with `stminaconnect://auth/callback?code=…`).
4. The OS opens the dev client; `app/auth/callback.tsx` calls `exchangeCodeForSession`, the auth store hydrates, and you land on the home screen.

The callback screen wraps the exchange in a 10-second wall-clock timeout. If the exchange never resolves (e.g., the app was reinstalled and the PKCE code-verifier was lost from SecureStore), the screen redirects to `/sign-in` rather than spinning indefinitely.

### Troubleshooting magic-link

If tapping the link doesn't open the app:

- Confirm the scheme is registered: open the dev-client build's `Info.plist` (iOS) or `AndroidManifest.xml` (Android) — should contain `stminaconnect`. If not, rebuild the dev client.
- Confirm Supabase's redirect allow-list contains `stminaconnect://auth/callback` (`supabase/config.toml` `additional_redirect_urls` for local; Authentication → URL Configuration on the hosted dashboard).
- Check the GoTrue version: older versions silently fall back to `site_url` for unknown schemes. Local Supabase CLI usually keeps GoTrue current.
- If the callback redirects you back to `/sign-in` within ~10 seconds, the device is missing the PKCE code-verifier (most often after a reinstall). Re-request a fresh link from the sign-in screen.

## 6. Versioning

`app.json` currently declares `0.99.0` — pre-1.0 release-candidate marker. The production phase (`setup-production-deployment`) bumps to `1.0.0`.

`runtimeVersion.policy` is `sdkVersion` — every JS-only change can ship via OTA without rebuilding the dev client.

## 7. When to re-build vs OTA reload

| Change                                                      | Action                                                            |
| ----------------------------------------------------------- | ----------------------------------------------------------------- |
| JS / TS / TSX / styles / strings / migrations / RPCs        | OTA reload (no rebuild)                                           |
| Add/remove npm package with a config plugin                 | Rebuild dev client                                                |
| Update Expo SDK                                             | Rebuild dev client                                                |
| Change `app.json` `scheme`, plugins, `ios`/`android` blocks | Rebuild dev client                                                |
| Personal-team Apple profile expired                         | Re-build (or re-install last build via TestFlight if not expired) |
