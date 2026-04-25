## Context

We've delayed the dev-build switch as long as possible, intentionally. With everything else done, the cost of the switch is contained: we add tooling, we don't touch functionality. The phase exists as its own change so that a regression in dev-build setup can't be confused with a regression in feature behavior.

## Goals

- A dev client that boots all existing flows identically to Expo Go.
- EAS profiles for development, preview, and production with reasonable defaults.
- Single Makefile-driven workflow.
- Solo dev can rebuild the dev client when SDK or native deps change.

## Non-Goals

- Real push notifications — phase 17.
- Production deployment — phase 18.
- iOS/Android store submission — out of v1; we use TestFlight + APK distribution.
- CI builds — local-only for now.

## Decisions

1. **`expo-dev-client` over the bare workflow.** We stay in the managed workflow with a custom dev client. Reason: still get OTA-style live reload, no `ios/`/`android/` directories to maintain, no Xcode/Android Studio for daily dev.
2. **EAS for builds.** Free tier sufficient for low build cadence. Build queue times tolerable.
3. **Three profiles**:
   - `development`: internal distribution, dev client embedded, `EXPO_PUBLIC_NOTIFICATION_DISPATCHER=mock` (still mock here — phase 17 swaps to real).
   - `preview`: internal distribution, no dev client, prod-like otherwise. Used for stakeholder previews.
   - `production`: store-ready signing, `EXPO_PUBLIC_NOTIFICATION_DISPATCHER=real`, env vars set to production Supabase project.
4. **Env var management**: EAS supports `eas.json`'s `env` blocks per profile. We reference values committed for non-secret vars and use `eas secret:create` for secret values like Supabase service keys (none on the client) and Google Calendar service account (server-only — actually goes in Supabase Edge Function secrets, not in the build).
5. **Dev client on iOS without paid Apple Developer**: tricky (provisioning profiles). For solo dev, we sign with a free personal team and re-install weekly when the dev profile expires. Documented. For preview/production, an Apple Developer account is required (Open Question H1-adjacent; deferred to phase 18 setup).
6. **Make targets**: keep `make expo-start` for emergency Expo Go runs (read-only/light-weight situations); add `make expo-start-dev-client` as the canonical command. Document both.
7. **Dev-client install flow**: `eas build --profile development --platform ios` produces a build accessible via a URL on Expo's site; scan the QR or open the URL to install. Same for Android (`eas build --profile development --platform android` → `.apk`).
8. **Versioning**: bump app version in `app.json` from `0.1.0` (phase 1 placeholder) to `0.99.0` to signal pre-1.0 status. Production phase will bump to `1.0.0`.
9. **Magic-link redirect URL switch** (resolves the deferred half of the auth phase's redirect decision): the Supabase Auth email template's redirect target is updated in this phase from the `exp://...` dev URL to `stminaconnect://auth/callback` — the production scheme declared back in `add-servant-auth`. Both URLs remain in the Supabase Auth allow-list during the transition; the dev URL stays for ongoing Expo Go work. Documented in `docs/dev-build.md`.
10. **Apple Developer enrolment**: solo developer enrols personally in the Apple Developer Program ($99/year) before this phase's iOS dev-client build is producible against a paid team. Free personal team builds remain available for low-friction iteration but expire every 7 days; paid enrolment is the path forward. Tracked as a v1 release gate.

## Risks / Trade-offs

- **Risk**: dev client builds take 10–30 minutes on EAS free tier. Mitigation: only rebuild when adding native deps; otherwise OTA reload still works.
- **Risk**: free Apple personal team profile expires every 7 days. Mitigation: documented re-install routine.
- **Trade-off**: not adopting CI build automation now. Manual builds are fine for solo + low cadence.

## Migration Plan

- Install `expo-dev-client` (npm).
- Run `eas build:configure` to generate the initial `eas.json`.
- Run `eas project:init` to link the EAS project.
- Build and verify a dev client on each platform.

## Open Questions

- None.
