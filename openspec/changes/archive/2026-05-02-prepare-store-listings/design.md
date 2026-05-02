## Context

Stores have idiosyncratic requirements (screenshot dimensions, character counts, asset formats, content rating questionnaires, privacy labels). Producing them under deadline pressure leads to mistakes that delay submission. We schedule a dedicated phase to do it deliberately, with multilingual copy and screenshots produced with real data.

## Goals

- Submission-ready for both Apple App Store and Google Play.
- Trilingual storefront from day one.
- Authentic screenshots (real seeded data, real brand visuals).
- Documented process so future submissions follow the same playbook.

## Non-Goals

- A marketing website with extensive content. A simple landing page is enough for the marketing URL.
- Promotional video production beyond a script outline.
- A11y review of store assets (screenshots are static images).
- Localization beyond EN/AR/DE.
- Public soft-launch / staged rollout strategy. Hard launch in DE first; expand later.

## Decisions

1. **Bundle identifier**: `com.stminaconnect` for both platforms. Reasons:
   - Reverse-DNS uses developer's domain `stminaconnect.com`.
   - Clear, brandable, future-proof.
   - Confirmed via amendment prompt; will request user confirmation in case it should be `de.stmina.connect` or similar.
2. **Category**: Lifestyle as primary, no secondary. Reasons:
   - Pastoral community apps fit Lifestyle better than Social Networking (which implies feed/messaging).
   - Lifestyle is broad enough to avoid recategorization disputes.
3. **App name + subtitle by locale**:
   - **EN**: name "St. Mina Connect"; subtitle "Pastoral care for your community".
   - **AR**: name "خدمة القديس مينا"; subtitle "خدمة رعويّة لجماعتك".
   - **DE**: name "St. Mina Connect"; subtitle "Pastorale Begleitung für deine Gemeinde".
4. **Short description shape (≤ 80 chars)**: focuses on the audience and the outcome — never marketing fluff. EN example: "Track attendance and stay connected with members of your church community."
5. **Full description shape (≤ 4000 chars)**: structured as:
   - One-paragraph overview.
   - "Built for servants" section.
   - "Built for your church" section.
   - "Privacy-first" section (calls out EU hosting, no tracking, GDPR rights).
   - "What's included in v1" bullet list.
   - "Coming soon" (kept short).
   - Contact / support line.
6. **Keywords (iOS)**: 100-char comma-separated. EN draft: `church, pastoral, attendance, community, follow-up, copts, coptic, parish, ministry, members`.
7. **Screenshots strategy**:
   - Capture in iOS Simulator (iPhone 14 Pro Max) and an Android emulator (Pixel 6) using a dev-client build with seeded data.
   - At least 3 screens per platform per locale: Quick Add filled in, Check-in roster mid-flow, Servant Dashboard with content.
   - Apply a frame template (device frame + brand-colored backdrop + headline) using `figma-export` or a small ImageMagick script — committed under `assets/store/screenshots/{ios,android}/{en,ar,de}/`.
   - Total: 3 screens × 2 platforms × 3 locales = 18 base screenshots. With device frames the visible deliverable count is the same.
8. **Age rating**: Apple's questionnaire answers all "None" for objectionable categories → 4+. Google's content rating: target Everyone. Documented in `docs/store/age-rating.md`.
9. **Privacy nutrition label** (iOS): drafted in `add-gdpr-compliance`; this phase finalizes and uploads via App Store Connect. Categories from that doc (Contact Info, User Content, Identifiers, Diagnostics) — all linked to user, none used for tracking.
10. **Marketing URL**:
    - `https://stminaconnect.com` — a simple landing page. Stack: same static-site host as the legal docs (Cloudflare Pages or GitHub Pages).
    - Page contains: app description (matching store description), screenshots, privacy/terms links, contact email.
11. **Support contact**: `support@stminaconnect.com`. Documented; mailbox setup is a sub-task.
12. **Distribution scope**:
    - **iOS**: Germany only, expandable.
    - **Android**: Germany only, expandable.
    - Both store listings rejected for users in other countries until expansion.
13. **Pricing**: Free. No in-app purchases.
14. **EAS submit config**:
    ```jsonc
    "submit": {
      "production": {
        "ios": {
          "appleId": "<apple-id>",
          "ascAppId": "<asc-app-id>",
          "appleTeamId": "<team>"
        },
        "android": {
          "serviceAccountKeyPath": "./secrets/play-service-account.json",
          "track": "internal"
        }
      }
    }
    ```
    `serviceAccountKeyPath` is gitignored and provisioned via `eas secret:create FILE`.
15. **Submission process docs**:
    - iOS: build → `eas submit -p ios --profile production` → App Store Connect → fill metadata (linked from this checklist) → submit for review.
    - Android: build → `eas submit -p android --profile production` → Play Console → upload screenshots → set rollout → release.

## Risks / Trade-offs

- **Risk**: Apple may flag the religious iconography in the icon. Mitigation: documented in `docs/store/age-rating.md` rationale that the cross is a generic identity mark; appeal process documented.
- **Risk**: Arabic store listings require Apple's Arabic localization to be enabled in App Store Connect. Mitigation: documented; one-time setup.
- **Trade-off**: not producing a video for v1. Saves significant time; can be added post-launch.
- **Risk**: screenshots need to be regenerated whenever UI shifts. Mitigation: a `make screenshots` target (deferred — not blocking v1 listing) automates the capture.

## Migration Plan

- N/A — purely additive documentation and assets.

## Open Questions

- Confirm bundle ID `com.stminaconnect` with user.
- Confirm marketing domain `stminaconnect.com` with user.
- None. Apple Developer enrolment is a documented release gate (see `setup-production-deployment` design § 14); solo developer enrols personally before this phase's submission tasks run.
