## ADDED Requirements

### Requirement: Hosted Supabase project in EU region

There SHALL be exactly one hosted Supabase project for v1, located in the EU (Frankfurt) region, with daily backups and point-in-time recovery enabled. Its project reference ID SHALL be documented in `docs/deployment.md`. All migrations in the repo SHALL be applied to this project before the first production build.

#### Scenario: Project location and backups

- **GIVEN** the production Supabase project
- **WHEN** an admin inspects project settings
- **THEN** the region is `eu-central-1` (Frankfurt)
- **AND** daily backups are enabled
- **AND** point-in-time recovery is enabled

#### Scenario: Migrations are fully applied

- **GIVEN** the production project
- **WHEN** `supabase db diff` is run against the repo
- **THEN** no schema differences are reported

### Requirement: CI enforces main-green

A GitHub Actions workflow SHALL run on every pull request and push to `main`, executing `make typecheck`, `make lint`, `make test`, and `openspec validate --all`. The `main` branch SHALL be protected: no merge without all CI checks passing. Node version in CI SHALL be 22 (LTS), matching `project.md`.

#### Scenario: PR with type error is blocked

- **GIVEN** a PR that introduces a TypeScript error
- **WHEN** CI runs
- **THEN** the `typecheck` step fails
- **AND** the PR cannot be merged

#### Scenario: OpenSpec validation is enforced

- **GIVEN** a PR that adds or modifies files under `openspec/changes/`
- **WHEN** CI runs
- **THEN** `openspec validate --all` runs
- **AND** an invalid change file causes the CI to fail

### Requirement: EAS Build profiles

The repo SHALL define two EAS Build profiles: `preview` (internal distribution via TestFlight internal + APK) and `production` (TestFlight external + Play internal). Both profiles SHALL point at the production Supabase project (no staging env in v1). The `preview` profile SHALL set `EXPO_PUBLIC_UAT_BANNER=true` so the app renders a visible "UAT MODE" banner.

#### Scenario: Preview build shows UAT banner

- **GIVEN** an app installed from the `preview` EAS profile
- **WHEN** any screen is rendered
- **THEN** a persistent top banner reads "UAT — test data only" in the user's locale

#### Scenario: Production build hides UAT banner

- **GIVEN** an app installed from the `production` EAS profile
- **WHEN** any screen is rendered
- **THEN** no UAT banner is shown

### Requirement: Deploy targets require confirmation

`make deploy-migrations env=production` and `make deploy-functions env=production` SHALL:
- Fail fast if `SUPABASE_ACCESS_TOKEN` is not set.
- Print a dry-run summary (schema diff or function list).
- Prompt the operator to type `yes` to proceed.
- Abort cleanly on any other input.

#### Scenario: Missing token aborts

- **GIVEN** `SUPABASE_ACCESS_TOKEN` is unset
- **WHEN** `make deploy-migrations env=production` runs
- **THEN** it exits non-zero with a message instructing how to obtain the token
- **AND** no deploy occurs

#### Scenario: Confirmation prompt

- **GIVEN** `SUPABASE_ACCESS_TOKEN` is set
- **WHEN** the operator runs `make deploy-migrations env=production`
- **THEN** a dry-run diff is printed
- **AND** the prompt reads: `Type 'yes' to apply to production:`
- **AND** any input other than `yes` cancels without changes

### Requirement: Runbook completeness

`docs/runbook.md` SHALL exist and document, at minimum: rotating Google service account keys, rotating Supabase service role, rotating Expo push credentials, rolling back a migration (reversible + unsafe cases), pausing cron jobs, toggling read-only mode via `app_config`, and investigating a Sentry incident. Each procedure SHALL list concrete commands and expected outputs, not prose alone.

#### Scenario: Runbook covers all critical ops

- **GIVEN** a reviewer inspects `docs/runbook.md`
- **WHEN** they search for each required section
- **THEN** every required section is present
- **AND** each section includes a numbered step list with commands

### Requirement: First-admin bootstrap is documented and versioned

`docs/deployment.md` SHALL describe the one-time first-admin bootstrap: the priest is invited via Supabase Studio, signs in to the app once, then a SQL snippet (`scripts/bootstrap-first-admin.sql`) promotes them to `admin`. The snippet SHALL be committed to the repo.

#### Scenario: Snippet exists and is parameterized

- **GIVEN** the repo at the production-deployment change's completion
- **WHEN** `scripts/bootstrap-first-admin.sql` is read
- **THEN** it contains an `UPDATE public.profiles SET role = 'admin' WHERE email = :email` statement
- **AND** the doc instructs the operator to replace `:email` with the priest's email

### Requirement: App store assets prepared (not submitted)

The repo SHALL contain store assets for EN/AR/DE: short + long descriptions, icon at 1024×1024, 3–5 screenshots per language per platform, privacy policy + terms URLs, and Play data-safety answers. No submission to public App Store or Play Store occurs as part of this change.

#### Scenario: Localized descriptions exist

- **GIVEN** the repo after this change
- **WHEN** `app-store-assets/descriptions/` is listed
- **THEN** `en.md`, `ar.md`, `de.md` all exist and contain non-empty short + long descriptions

#### Scenario: Screenshots cover required sizes

- **GIVEN** `app-store-assets/screenshots/`
- **WHEN** a reviewer inspects the folder
- **THEN** 3–5 screenshots exist per language per platform in the required store dimensions

### Requirement: Secrets never in .env

Production secrets (Supabase service role, Google SA private key, Sentry DSN, Expo access token) SHALL live only in the Supabase dashboard secrets store and EAS Build secrets. They SHALL NOT appear in any `.env*` file in the repo. `.env.production.example` SHALL contain only `EXPO_PUBLIC_*` vars (which are shipped to the client anyway).

#### Scenario: No secret in .env.production.example

- **GIVEN** the `.env.production.example` file
- **WHEN** a reviewer searches for `SERVICE_ROLE`, `PRIVATE_KEY`, `SUPABASE_ACCESS_TOKEN`
- **THEN** none of them appear
- **AND** only `EXPO_PUBLIC_*` keys are listed
