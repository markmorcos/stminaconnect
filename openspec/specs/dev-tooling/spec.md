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

All routine developer commands listed in `project.md` §6 (sans dev-build targets, which are added in phase 16) MUST be invocable through `make <target>`. Direct invocations of underlying CLIs are allowed but not required.

#### Scenario: All in-scope Make targets exist

- **WHEN** the developer runs `make help` (or `make` with no target — printing a list)
- **THEN** the output lists at least: `install`, `dev-up`, `dev-down`, `migrate-up`, `migrate-down`, `migrate-new`, `seed`, `lint`, `typecheck`, `test`, `test-coverage`, `expo-start`, `deploy-functions`, `deploy-migrations`
- **AND** `expo-start-dev-client` is NOT yet present (it arrives in phase 16)

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

The `app.json` file MUST set `expo.ios.bundleIdentifier` and `expo.android.package` to `tech.morcos.stminaconnect` (or the value confirmed with the user). The repository MUST contain `assets/branding/`, `assets/icons/`, `assets/fonts/`, `assets/images/`, each with at minimum a `.gitkeep` placeholder. A placeholder app icon and splash MUST be configured so the app boots without errors before `add-brand-assets` lands.

#### Scenario: Bundle id present

- **WHEN** a reviewer inspects `app.json`
- **THEN** `expo.ios.bundleIdentifier` and `expo.android.package` are both `tech.morcos.stminaconnect`

#### Scenario: Asset folders exist

- **WHEN** a reviewer inspects the repository root
- **THEN** `assets/branding/`, `assets/icons/`, `assets/fonts/`, `assets/images/` all exist
- **AND** the configured `expo.icon` and `expo.splash.image` paths resolve to existing placeholder files
