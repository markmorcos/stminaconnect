# Tasks — prepare-store-listings

## 1. Bundle id + EAS submit config

- [x] 1.1 Confirm bundle id with user; default `com.stminaconnect` for both platforms.
- [x] 1.2 Update `app.json`: `expo.ios.bundleIdentifier`, `expo.android.package`.
- [x] 1.3 Update `eas.json` with the `submit` block per `design.md` § 14.
- [ ] 1.4 Provision `secrets/play-service-account.json` via `eas secret:create FILE` (gitignored locally). _Blocked — Play developer-account activation is pending Google ID verification (two failed payment attempts as of 2026-05-02)._

## 2. Listing copy

- [x] 2.1 Draft EN: app name, subtitle, short description (≤ 80), full description (≤ 4000), keywords (100 chars). Save under `docs/store/listings/en.md`.
- [x] 2.2 Translate to AR — `docs/store/listings/ar.md`.
- [x] 2.3 Translate to DE — `docs/store/listings/de.md`.
- [x] 2.4 Native-speaker review pass on AR and DE. _Done via review-and-edit agent on 2026-05-02; AR/DE files updated in place. `_review.md` removed — edits are baked into the listing files._

## 3. Screenshots

iOS captures are deferred until Apple Developer enrolment lands; Android-only for the v1 launch.

- [x] 3.1 Run `supabase/preview-seed.sql` against the preview Supabase project, then build a dev client pointed at it (5 servants + 20 persons + recent attendance + alerts).
- [x] 3.2 Set device locale to EN; capture: Quick Add filled in, Check-in roster mid-flow, Servant Dashboard with content. Save to `assets/store/screenshots/android/en/`.
- [x] 3.3 Repeat for AR locale; save under `assets/store/screenshots/android/ar/`.
- [x] 3.4 Repeat for DE locale; save under `assets/store/screenshots/android/de/`.
- [x] 3.5 Apply device-frame + brand backdrop via `scripts/screenshot-frame.sh` (ImageMagick, `ROUNDED=1 SHADOW=1`) — output under `assets/store/screenshots-framed/android/...`. Per-locale framed copies also live under `marketing/public/screenshots/{en,ar,de}/` so each landing page renders its own locale's screens.

## 4. Age rating

- [x] 4.1 `docs/store/age-rating.md`: answer iOS questionnaire (all No → 4+); answer Google IARC (all No → Everyone). Document the religious-iconography rationale per design.

## 5. iOS Privacy nutrition label

- [x] 5.1 `docs/store/ios-privacy-label-final.md`: lock the matrix from `add-gdpr-compliance` § 12. Mark each category with the action the submission UI requires.

## 6. Marketing site + URLs

- [x] 6.1 `docs/marketing/landing.md`: copy for the landing page (app description, three screenshots, privacy/terms links, support email).
- [x] 6.2 Deploy landing page on `stminaconnect.com`. Live: trilingual landings (`/`, `/ar/`, `/de/`), 404, `robots.txt`, `sitemap.xml`, 6 rendered legal pages from `docs/legal/*.md` via `deno task render-legal`, favicon / og:image / JSON-LD, per-locale screenshots. Helm chart `infrastructure@0.4.7` via the `deploy-stminaconnect` `repository_dispatch` event; workflow `.github/workflows/deploy-marketing.yml` re-deploys on any push under `marketing/**`.
- [x] 6.3 `support@stminaconnect.com` email alias provisioned (Cloudflare Email Routing → developer inbox; outbound from the same domain via Resend SMTP, plugged into Supabase Auth so the 2/hour Supabase default is gone).

## 7. App Store Connect setup

- [x] 7.1 `docs/store/submission-ios.md`: stepwise — Apple Developer enrolment, App Store Connect app record creation, paste metadata, upload screenshots, fill privacy nutrition label, attach Privacy Policy URL, run `eas submit`, submit for review.

## 8. Google Play Console setup

- [x] 8.1 `docs/store/submission-android.md`: stepwise — Play Console app creation, upload listing, screenshots, content rating, data safety form (mirrors iOS Privacy nutrition label), pricing, distribution, internal testing track release, then production rollout.

## 9. Verification

- [x] 9.1 All listing copy reviewed and within character limits (subtitle ≤ 30, short ≤ 80, full ≤ 4000, keywords ≤ 100). Edits baked into `ar.md` and `de.md`; `_review.md` removed.
- [x] 9.2 All screenshot assets present under the expected Android folders (iOS deferred per § 3 note).
- [x] 9.3 Bundle ids match across `app.json` and `eas.json`.
- [x] 9.4 Marketing URL responds with a 200 and renders content.
- [x] 9.5 `support@stminaconnect.com` autoresponder configured.
- [x] 9.6 `openspec validate prepare-store-listings` passes.
