# store-readiness — Spec Delta

## ADDED Requirements

### Requirement: A canonical bundle identifier SHALL be configured for both stores.

The iOS `bundleIdentifier` and Android `package` MUST both be `tech.morcos.stminaconnect` (or the value confirmed with the user). The identifier MUST appear in `app.json` and MUST match the EAS submit config in `eas.json`.

#### Scenario: Bundle id consistent across config

- **WHEN** a reviewer inspects `app.json` and `eas.json`
- **THEN** `expo.ios.bundleIdentifier`, `expo.android.package`, and the EAS submit config all reference the same identifier

### Requirement: Store listing copy SHALL exist in EN, AR, and DE.

For each language, the repository MUST contain:
- App name and subtitle.
- Short description (≤ 80 chars).
- Full description (≤ 4000 chars).
- Keywords / search tags.

The content lives under `docs/store/listings/{en,ar,de}.md`. AR and DE drafts MUST be reviewed by a native speaker and marked off in `_review.md` before any store submission.

#### Scenario: All three language files exist and are reviewed

- **WHEN** a reviewer inspects `docs/store/listings/`
- **THEN** `en.md`, `ar.md`, `de.md`, `_review.md` all exist
- **AND** `_review.md` records the reviewer name and date for AR and DE

### Requirement: At least three localized screenshots per platform SHALL exist.

`assets/store/screenshots-framed/{ios,android}/{en,ar,de}/` MUST each contain at least three image files corresponding to:
- Quick Add screen (mid-fill).
- Check-in roster (mid-toggle).
- Servant Dashboard (with content).

Images MUST be captured against the design-system theme using realistic seeded data.

#### Scenario: Folder structure complete

- **WHEN** a reviewer inspects `assets/store/screenshots-framed/`
- **THEN** the six locale-platform folders each contain ≥ 3 framed PNG files

### Requirement: Age rating answers SHALL be documented.

`docs/store/age-rating.md` MUST contain Apple's age-rating questionnaire answers (target 4+) and Google's IARC questionnaire answers (target Everyone). The document MUST also note any rationale needed for ambiguous categories (e.g., religious iconography).

#### Scenario: Rationale for icon present

- **WHEN** the document is reviewed
- **THEN** there is a paragraph addressing the cross-derived icon as a generic brand mark and not a category trigger

### Requirement: An iOS Privacy nutrition label SHALL be finalized.

`docs/store/ios-privacy-label-final.md` MUST list every Apple App Privacy category, the data collected (or "not collected"), whether each is linked to user identity, and whether each is used for tracking. Tracking MUST be "No" for every category.

#### Scenario: Tracking is no for all

- **WHEN** the document is reviewed
- **THEN** every category marks "Used for tracking: No"

### Requirement: A marketing URL and a support contact SHALL be live.

The marketing URL `https://stmina.morcos.tech` MUST be reachable, return HTTP 200, and render content matching the store description. A support email (`support@morcos.tech` or equivalent) MUST be provisioned and capable of receiving mail before any store submission.

#### Scenario: Marketing site live

- **WHEN** a curl/HEAD request hits the marketing URL
- **THEN** the response is 200
- **AND** the page contains the app name and a screenshot

#### Scenario: Support email accepts mail

- **WHEN** a test email is sent to the support address
- **THEN** it is delivered (no bounce) and the autoresponder fires

### Requirement: EAS submit profiles SHALL be configured for both platforms.

`eas.json` MUST contain a `submit.production.ios` and `submit.production.android` configuration. The Play service account JSON path MUST be referenced; the file itself MUST be gitignored. App Store Connect appleId / ascAppId / appleTeamId MUST be populated.

#### Scenario: Submit profile config present

- **WHEN** a reviewer inspects `eas.json`
- **THEN** the `submit.production.ios` and `submit.production.android` blocks are present
- **AND** all required identifiers are populated

#### Scenario: Service account JSON gitignored

- **WHEN** a reviewer runs `git check-ignore secrets/play-service-account.json`
- **THEN** the path is reported as ignored

### Requirement: Submission process documentation SHALL exist for both stores.

`docs/store/submission-ios.md` and `docs/store/submission-android.md` MUST each contain a stepwise checklist from build to live release. Each step MUST be completable by a developer with no prior submission experience.

#### Scenario: A new developer can follow the docs

- **WHEN** a fresh contributor reads `docs/store/submission-ios.md`
- **THEN** the checklist takes them through Apple Developer enrolment, App Store Connect setup, EAS submit invocation, and review submission without ambiguity
