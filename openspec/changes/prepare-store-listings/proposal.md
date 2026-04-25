## Why

Store assets — listing copy, screenshots, ratings, privacy labels — take real time to produce in three languages and cannot be an afterthought. We schedule this between real-push (which finalizes the production-build feature set) and production-deployment (which submits). Internal builds via TestFlight/APK in earlier phases are fine without store listings; **public** distribution requires everything in this phase.

## What Changes

- **ADDED** capability `store-readiness`.
- **ADDED** `docs/store/checklist.md`: full submission checklist for both stores.
- **ADDED** Bundle id confirmation: `tech.morcos.stminaconnect` (iOS) / `tech.morcos.stminaconnect` (Android).
- **ADDED** Store listing copy in EN/AR/DE:
  - App name + subtitle.
  - Short description (≤ 80 chars).
  - Full description (≤ 4000 chars).
  - Keywords (iOS) / search tags.
- **ADDED** App category: Lifestyle (primary). Social Networking considered but Lifestyle better matches a community/pastoral app.
- **ADDED** Age rating questionnaire answers documented for both stores (target: 4+ / Everyone).
- **ADDED** Promotional screenshots: at least 3 per platform per language showing Quick Add, Check-in, Servant Dashboard. Captured in dev-build using realistic seed data; light theme used for screenshots; a frame template applied.
- **ADDED** Optional preview video script outline (one 30-second walkthrough; not a hard requirement for v1 launch).
- **ADDED** iOS App Privacy nutrition label finalized (drafted in `add-gdpr-compliance`).
- **ADDED** Marketing URL (church website or simple landing page on `stmina.morcos.tech`) and support contact info.
- **ADDED** Pricing & distribution: free; Germany-only at first; expandable later.
- **ADDED** EAS submission profile config in `eas.json`.
- **ADDED** Documented submission process for both platforms (`docs/store/submission-ios.md`, `docs/store/submission-android.md`).

## Impact

- **Affected specs**: `store-readiness` (new).
- **Affected code**: no application code changes. New `docs/store/`, new `assets/store/screenshots/`, updated `eas.json` submit config.
- **Breaking changes**: none.
- **Migration needs**: none.
- **Expo Go compatible**: N/A — this phase is documentation + assets; submissions happen against EAS production builds.
- **Uses design system**: yes — screenshots are taken against design-system-themed screens.
- **Dependencies**: `replace-mock-with-real-push`, `add-gdpr-compliance`, `add-brand-assets`, `add-admin-dashboard`. Lands before `setup-production-deployment`.
