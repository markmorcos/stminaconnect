# Tasks — prepare-store-listings

## 1. Bundle id + EAS submit config

- [ ] 1.1 Confirm bundle id with user; default `tech.morcos.stminaconnect` for both platforms.
- [ ] 1.2 Update `app.json`: `expo.ios.bundleIdentifier`, `expo.android.package`.
- [ ] 1.3 Update `eas.json` with the `submit` block per `design.md` § 14.
- [ ] 1.4 Provision `secrets/play-service-account.json` via `eas secret:create FILE` (gitignored locally).

## 2. Listing copy

- [ ] 2.1 Draft EN: app name, subtitle, short description (≤ 80), full description (≤ 4000), keywords (100 chars). Save under `docs/store/listings/en.md`.
- [ ] 2.2 Translate to AR — `docs/store/listings/ar.md`.
- [ ] 2.3 Translate to DE — `docs/store/listings/de.md`.
- [ ] 2.4 Native-speaker review pass on AR and DE.

## 3. Screenshots

- [ ] 3.1 Build a dev client; load realistic seed (5 servants + 20 persons + recent attendance + alerts).
- [ ] 3.2 Set device locale to EN; capture: Quick Add filled in, Check-in roster mid-flow, Servant Dashboard with content. Save to `assets/store/screenshots/{ios,android}/en/`.
- [ ] 3.3 Repeat for AR locale; save under `.../ar/`.
- [ ] 3.4 Repeat for DE locale; save under `.../de/`.
- [ ] 3.5 Apply device-frame + brand backdrop via `scripts/screenshot-frame.sh` (ImageMagick) — output under `assets/store/screenshots-framed/...`.

## 4. Age rating

- [ ] 4.1 `docs/store/age-rating.md`: answer iOS questionnaire (all No → 4+); answer Google IARC (all No → Everyone). Document the religious-iconography rationale per design.

## 5. iOS Privacy nutrition label

- [ ] 5.1 `docs/store/ios-privacy-label-final.md`: lock the matrix from `add-gdpr-compliance` § 12. Mark each category with the action the submission UI requires.

## 6. Marketing site + URLs

- [ ] 6.1 `docs/marketing/landing.md`: copy for the landing page (app description, three screenshots, privacy/terms links, support email).
- [ ] 6.2 Deploy landing page on `stmina.morcos.tech` via the same hosting setup as the legal docs.
- [ ] 6.3 `support@morcos.tech` email alias provisioned and documented.

## 7. App Store Connect setup

- [ ] 7.1 `docs/store/submission-ios.md`: stepwise — Apple Developer enrolment, App Store Connect app record creation, paste metadata, upload screenshots, fill privacy nutrition label, attach Privacy Policy URL, run `eas submit`, submit for review.

## 8. Google Play Console setup

- [ ] 8.1 `docs/store/submission-android.md`: stepwise — Play Console app creation, upload listing, screenshots, content rating, data safety form (mirrors iOS Privacy nutrition label), pricing, distribution, internal testing track release, then production rollout.

## 9. Verification

- [ ] 9.1 All listing copy proofread by native speakers (mark off in `docs/store/listings/_review.md`).
- [ ] 9.2 All screenshot assets present under the expected folders.
- [ ] 9.3 Bundle ids match across `app.json` and `eas.json`.
- [ ] 9.4 Marketing URL responds with a 200 and renders content.
- [ ] 9.5 `support@morcos.tech` autoresponder configured.
- [ ] 9.6 `openspec validate prepare-store-listings` passes.
