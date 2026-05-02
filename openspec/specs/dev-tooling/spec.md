# dev-tooling Specification

## Purpose

Defines the developer-facing tooling, scaffolding, and quality gates that make St. Mina Connect runnable end-to-end on a fresh machine. Covers the local-stack quick start, the canonical Make command surface, the Supabase JS client wiring, pre-commit checks, the placeholder home screen used to verify the toolchain, and the bundle/asset configuration consumed by downstream phases.

## Requirements

### Requirement: The repository SHALL provide a one-command quick start that boots the full local stack.

A new contributor (or returning solo developer on a fresh machine) MUST be able to run the app in Expo Go without manually invoking Supabase CLI subcommands or the Expo CLI.

#### Scenario: First-time setup succeeds in under 60 seconds of active commands

- **GIVEN** a fresh clone of the repository
- **AND** Node 20 LTS and Docker are installed on the host
- **AND** the developer has copied `.env.example` to `.env.local` and populated the Supabase URL and anon key from `make dev-up` output
- **WHEN** the developer runs `make install` then `make dev-up` then `npx expo start`
- **AND** scans the QR code with Expo Go on a physical device
- **THEN** the app launches and displays a screen titled "St. Mina Connect — initializing"
- **AND** no error is logged in the Expo dev tools console

#### Scenario: Missing Docker is reported clearly

- **GIVEN** Docker is NOT installed on the host
- **WHEN** the developer runs `make dev-up`
- **THEN** the command exits non-zero with a message instructing the developer to install Docker before continuing

### Requirement: The Supabase client SHALL be importable and constructible without throwing.

A configured Supabase JS client MUST be exported from `src/services/api/supabase.ts`. It SHALL read its URL and anon key from `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. It SHALL persist auth state via AsyncStorage so that future phases can build on session persistence.

#### Scenario: Smoke test confirms client construction

- **GIVEN** valid Supabase URL and anon key are set in the test environment
- **WHEN** the smoke test under `tests/smoke/supabaseClient.test.ts` runs
- **THEN** importing `src/services/api/supabase.ts` does not throw
- **AND** `supabase.auth.getSession()` returns an object (resolved Promise; null session is acceptable)

#### Scenario: Missing env vars surface a developer-friendly error

- **GIVEN** `EXPO_PUBLIC_SUPABASE_URL` is unset
- **WHEN** the app boots in Expo Go
- **THEN** the placeholder screen renders an error banner reading "Supabase URL not configured. See README."
- **AND** the dev console logs the missing-var name explicitly

### Requirement: The Makefile SHALL be the canonical command surface for development.

All routine developer commands listed in `project.md` §6 MUST be invocable through `make <target>`. Direct invocations of underlying CLIs are allowed but not required.

#### Scenario: All in-scope Make targets exist

- **WHEN** the developer runs `make help` (or `make` with no target — printing a list)
- **THEN** the output lists at least: `install`, `dev-up`, `dev-down`, `migrate-up`, `migrate-down`, `migrate-new`, `seed`, `lint`, `typecheck`, `test`, `test-coverage`, `expo-start`, `expo-start-dev-client`, `deploy-functions`, `deploy-migrations`

### Requirement: A development build SHALL be the canonical local-development target.

`expo-dev-client` MUST be installed and the documented daily-development command MUST be `make expo-start-dev-client`. The legacy `make expo-start` (Expo Go) command MUST remain functional but is no longer the recommended path.

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

### Requirement: Pre-commit checks SHALL run lint and typecheck on staged changes.

Solo developers cannot afford to commit broken code. A husky-managed pre-commit hook MUST run lint-staged (lint + format on staged files) and `npm run typecheck` (full project) before every commit.

#### Scenario: Commit blocked on type error

- **GIVEN** a TypeScript type error in `src/some-file.ts`
- **WHEN** the developer runs `git commit`
- **THEN** the pre-commit hook exits non-zero
- **AND** no commit is created

### Requirement: The placeholder home screen SHALL render in Expo Go.

The `app/index.tsx` route MUST render a Paper `Surface` containing the text "St. Mina Connect — initializing" with no other content. It serves as proof of the toolchain working end-to-end.

#### Scenario: Placeholder visible after fresh boot

- **GIVEN** the dev stack is up and the app is loaded in Expo Go
- **WHEN** the placeholder screen renders
- **THEN** the text "St. Mina Connect — initializing" is visible
- **AND** the dev console logs "Supabase client initialized" exactly once

### Requirement: Bundle identifier and asset folder structure SHALL be configured for downstream phases.

The `app.json` file MUST set `expo.ios.bundleIdentifier` and `expo.android.package` to `com.stminaconnect` (or the value confirmed with the user). The repository MUST contain `assets/branding/`, `assets/icons/`, `assets/fonts/`, `assets/images/`, each with at minimum a `.gitkeep` placeholder. A placeholder app icon and splash MUST be configured so the app boots without errors before `add-brand-assets` lands.

#### Scenario: Bundle id present

- **WHEN** a reviewer inspects `app.json`
- **THEN** `expo.ios.bundleIdentifier` and `expo.android.package` are both `com.stminaconnect`

#### Scenario: Asset folders exist

- **WHEN** a reviewer inspects the repository root
- **THEN** `assets/branding/`, `assets/icons/`, `assets/fonts/`, `assets/images/` all exist
- **AND** the configured `expo.icon` and `expo.splash.image` paths resolve to existing placeholder files

### Requirement: A read-only SQLite inspector SHALL be reachable from the home menu in dev / preview builds.

A `/dev/db` route MUST render the local SQLite mirror's structure and
contents:

- A list of every user table with column count and row count.
- The `sync_meta` key/value contents inline (`last_pull_at`,
  `schema_version`, future flags).
- A "Peek" affordance per table that opens a sheet showing column
  definitions (name, type, NOT NULL, PK) and the first 50 rows.
- A read-only SQL REPL accepting only `SELECT`, `PRAGMA`, or
  `WITH … SELECT` statements. Any other statement MUST be rejected at
  the input layer with a clear error message; the underlying call uses
  `getAllAsync` so write semantics are not exposed even if the regex
  is bypassed.

The route MUST be discoverable via the home overflow menu only when
`__DEV__` is true OR `EXPO_PUBLIC_SHOW_DEV_TOOLS=true`. End-user
production builds MUST NOT expose the entry point.

#### Scenario: Inspector lists tables with row counts

- **GIVEN** the local SQLite mirror has been populated by a prior sync
- **WHEN** an authenticated user opens `/dev/db`
- **THEN** the screen lists `persons`, `events`, `attendance`,
  `notifications`, `local_sync_queue`, `sync_meta` (and any future
  tables) with their row counts
- **AND** `sync_meta.last_pull_at` is rendered inline

#### Scenario: Read-only REPL rejects mutations

- **WHEN** the developer enters `DELETE FROM persons` and taps Run
- **THEN** the REPL surfaces "Only SELECT, PRAGMA, or WITH … SELECT
  statements are allowed."
- **AND** no rows are deleted

#### Scenario: Inspector hidden in production

- **GIVEN** a production-flavoured build with `__DEV__ === false` and
  `EXPO_PUBLIC_SHOW_DEV_TOOLS` unset
- **WHEN** the home overflow menu is opened
- **THEN** the "DB Inspector" entry is not rendered
- **AND** any direct navigation attempt to `/dev/db` resolves to a
  404-equivalent route fallback

### Requirement: A "Wipe local DB" action SHALL reset the mirror without invalidating auth.

The `/dev/db` screen MUST expose a destructive action that:

1. Closes the current SQLite connection and deletes the database file
   via `expo-sqlite`'s `deleteDatabaseAsync`.
2. Resets the cached database promise so the next access reopens with
   a fresh schema (migrations re-run on the empty file).
3. Resets in-memory mirrors that read from the gone DB:
   `useSyncState` returns to its initial values (`lastPullAt = null`,
   `hasCompletedFirstPull = false`, queue length 0,
   `conflictedPersonName = null`); `useNotificationsStore` empties.
4. Refreshes the inspector view so the new empty tables render.
5. Kicks `getSyncEngine().runOnce()` so a fresh pull starts and the
   mirror repopulates from the server.

The action MUST be guarded by a confirmation modal that explains what
gets deleted (local cache, sync watermark, queued ops, in-memory
notifications) and what is preserved (auth session, server data). The
modal MUST be undismissable while the wipe is in flight.

#### Scenario: Wipe resets cache + watermark and triggers re-pull

- **GIVEN** the local mirror contains rows and `last_pull_at` is set
- **WHEN** the developer confirms the wipe
- **THEN** the mirror tables are empty when the inspector refreshes
- **AND** `sync_meta.last_pull_at` is null
- **AND** `useSyncState.hasCompletedFirstPull` is false
- **AND** within a few seconds, the SyncEngine completes a fresh pull
  and the row counts return to non-zero (assuming the user is online)

#### Scenario: Wipe preserves auth

- **GIVEN** an authenticated session
- **WHEN** the developer wipes the local DB
- **THEN** the user is NOT signed out
- **AND** the home screen continues to render under the same servant
  identity

#### Scenario: Pending queue ops are intentionally dropped

- **GIVEN** the local sync queue has unpushed mutations
- **WHEN** the wipe runs
- **THEN** those ops are deleted with the rest of the file
- **AND** the confirmation modal copy explicitly warned the developer
  that pending queued ops will be lost

### Requirement: Migrations and Edge Functions SHALL be deployable to production via Makefile targets.

`make deploy-migrations` MUST run all unapplied migrations against the linked production Supabase project. `make deploy-functions` MUST iterate over `supabase/functions/*` and deploy each one. Both targets MUST require an explicit `PROJECT=prod` argument or interactive confirmation to prevent accidental misuse.

#### Scenario: Migrations applied to production

- **GIVEN** the local repo is linked to the production Supabase project
- **WHEN** the developer runs `make deploy-migrations PROJECT=prod`
- **AND** confirms the prompt
- **THEN** `supabase db push` runs against production
- **AND** the production schema reflects all migrations through the latest applied locally

#### Scenario: Functions deployed to production

- **WHEN** the developer runs `make deploy-functions PROJECT=prod`
- **THEN** each function in `supabase/functions/*` is deployed via `supabase functions deploy --project-ref <prod-ref>`
- **AND** the production Edge Functions list matches local

### Requirement: A weekly off-Supabase backup SHALL run automatically.

A `weekly-backup` Edge Function MUST run on a `pg_cron` schedule every Sunday at 02:00 Europe/Berlin. It MUST `pg_dump` the database and upload the resulting file to Backblaze B2. The retention policy MUST keep at least 4 weeks of weekly archives.

#### Scenario: Weekly backup uploaded

- **WHEN** the cron schedule fires
- **THEN** an object is created in the configured B2 bucket with a date-stamped key
- **AND** the object is at least 1KB (signal of a non-empty dump)

#### Scenario: Manual run produces an object

- **GIVEN** an admin manually invokes `weekly-backup` via Supabase Dashboard or `curl`
- **WHEN** the function completes
- **THEN** a new object is in B2

### Requirement: Production EAS builds SHALL produce signed iOS and Android binaries.

`make build-prod` MUST produce iOS `.ipa` and Android `.aab` (or `.apk` for direct distribution) signed with production credentials. The production profile in `eas.json` MUST set `EXPO_PUBLIC_NOTIFICATION_DISPATCHER=real` and the production Supabase URL / anon key.

#### Scenario: iOS build is signed and uploadable to TestFlight

- **WHEN** `make build-prod` completes for iOS
- **THEN** the resulting `.ipa` is signed with the production team's distribution certificate
- **AND** `eas submit --platform ios` accepts it for TestFlight upload

#### Scenario: Android build is signed and installable

- **WHEN** `make build-prod` completes for Android
- **THEN** the resulting `.aab`/`.apk` is signed with the EAS-managed keystore
- **AND** can be installed on an Android device

### Requirement: Production deployment runbooks SHALL exist and cover routine ops.

The repository MUST contain `docs/production-setup.md` (first-time setup), `docs/runbook.md` (ongoing ops including invite, GDPR erasure, backup verification, app version bump), and `docs/incident-response.md` (auth/sync/push outages). Each MUST be navigable from the main README.

#### Scenario: Runbook covers GDPR erasure

- **WHEN** a reviewer reads `docs/runbook.md`
- **THEN** there is a section titled "Right-to-Erasure" describing:
  - The GDPR Article 17 hard-erasure path (Admin Compliance screen, introduced in `add-gdpr-compliance`) as the primary mechanism — distinct from the general-churn soft-delete on the person profile.
  - Confirmation that the live DB row is removed and attendance is anonymized via `was_anonymized=true`.
  - Acknowledgement that backups (Supabase 7d + B2 90d) still contain the data until retention expires.
  - Steps to expedite removal from backups if legally required (Supabase support ticket + B2 object deletion).

### Requirement: All production credentials SHALL live in EAS secrets or Supabase Edge Function secrets — never in the repo.

Production env vars in `eas.json` MUST reference EAS secrets (`EAS_PROD_SUPABASE_URL`, etc.) for any value that would otherwise be sensitive. Edge Function secrets (`GOOGLE_SERVICE_ACCOUNT_KEY`, `BACKBLAZE_KEY`, etc.) MUST be set via `supabase secrets set` and never committed.

#### Scenario: Repo grep finds no production secrets

- **WHEN** a reviewer runs a strict grep for production keys, service account JSON fragments, or B2 keys across the repo
- **THEN** no matches are found in tracked files

### Requirement: The production version SHALL be tagged in git as `v1.0.0`.

`app.json`'s version MUST be `1.0.0` after this change. The corresponding commit MUST be tagged `v1.0.0` to mark the production release.

#### Scenario: Version bumped and tagged

- **WHEN** the change is archived
- **THEN** `app.json` shows `"version": "1.0.0"`
- **AND** `git tag -l v1.0.0` returns the tag
- **AND** the tag points to a commit that builds the production binaries
