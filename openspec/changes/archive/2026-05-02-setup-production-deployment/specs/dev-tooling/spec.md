# dev-tooling — Spec Delta

## ADDED Requirements

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
