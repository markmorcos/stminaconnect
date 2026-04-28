# dev-tooling — Spec Delta

## ADDED Requirements

### Requirement: A development build SHALL be the canonical local-development target.

After this change, `expo-dev-client` MUST be installed and the documented daily-development command MUST be `make expo-start-dev-client`. The legacy `make expo-start` (Expo Go) command MUST remain functional but is no longer the recommended path.

#### Scenario: Dev client connects to dev server

- **GIVEN** a dev client is installed on the developer's phone
- **WHEN** the developer runs `make expo-start-dev-client`
- **AND** opens the dev client and selects the dev server URL
- **THEN** the app launches in the dev client
- **AND** behaves identically to the Expo Go-rendered app for all flows from phases 1–15

### Requirement: EAS profiles SHALL exist for development, preview, and production builds.

`eas.json` MUST define three profiles. The development profile MUST embed `expo-dev-client`. The preview profile MUST be production-like but signed for internal distribution. The production profile MUST produce store-ready iOS and Android binaries.

#### Scenario: Dev profile produces an installable dev client

- **WHEN** `eas build --profile development --platform ios` runs
- **THEN** the resulting build is an `.ipa`/`.tar.gz` that installs on the dev phone
- **AND** running it opens the dev client UI

#### Scenario: Production profile env vars

- **WHEN** an admin inspects `eas.json`
- **THEN** the production profile sets `EXPO_PUBLIC_NOTIFICATION_DISPATCHER=real`
- **AND** points to the production Supabase URL/anon key

### Requirement: Make targets SHALL drive build operations.

The Makefile MUST include `expo-start-dev-client`, `build-dev-ios`, `build-dev-android`, `build-preview`, and `build-prod`. The production target MUST require interactive confirmation.

#### Scenario: Production build prompts for confirmation

- **WHEN** the developer runs `make build-prod`
- **THEN** the command prompts: "Confirm production build? [y/N]"
- **AND** anything other than `y` aborts before invoking EAS

### Requirement: This change SHALL NOT alter user-visible app behavior.

The dev-build switch is tooling-only. After this change is archived, the app's flows, screens, and feature set MUST be identical to those at the end of phase 15. Any behavioral change discovered during dev-client smoke testing MUST be filed as a separate change before this phase is archived.

#### Scenario: Smoke flows match Expo Go

- **GIVEN** the same test data and credentials
- **WHEN** the same flow is performed in Expo Go and in the dev client
- **THEN** the visible UI, the persisted data, and the notification dispatch are identical
