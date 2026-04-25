## Why

The app is feature-complete and dev-build-ready. Production deployment is a non-trivial set of steps — provisioning a hosted Supabase project, deploying migrations and Edge Functions, wiring secrets, configuring backups, building TestFlight + APK distributions, writing the runbook for ongoing ops. We do this last to avoid the cognitive overhead of dual-environment management during feature work.

## What Changes

- **MODIFIED** `dev-tooling` capability — adds production deployment surface.
- **CONSUMES** `prepare-store-listings` outputs:
  - Final app icons (1024×1024 source + Android adaptive foreground 432×432) from `assets/branding/` (produced in `add-brand-assets`).
  - Final splash screens (light + dark) from `assets/branding/`.
  - Store screenshots (3 per platform per language, framed) from `assets/store/screenshots-framed/`.
  - Store listing copy (EN/AR/DE) from `docs/store/listings/`.
  - Privacy Policy and Terms hosted URLs from `add-gdpr-compliance`.
  - iOS Privacy nutrition label content from `docs/store/ios-privacy-label-final.md`.
  - Age rating answers from `docs/store/age-rating.md`.
  - Submission process docs from `docs/store/submission-{ios,android}.md`.
- **ADDED** TestFlight and Play Console internal distribution for the v1.0.0 build, leveraging the prepared assets.
- **ADDED** `docs/production-setup.md` runbook covering:
  - Creating the production Supabase project (Frankfurt EU region).
  - Linking local repo to it.
  - Running all migrations in order via `make deploy-migrations`.
  - Deploying all Edge Functions via `make deploy-functions`.
  - Setting Edge Function secrets (Google service account, Expo push credentials, etc.).
  - Configuring Supabase Auth allowed redirect URLs.
  - Configuring Storage (none needed in v1) and Realtime (enabled by default).
  - Backups: daily automatic Supabase backups (free-tier 7d) + weekly `pg_dump` to Backblaze B2.
- **ADDED** `Makefile` targets — actually wiring the placeholder deploy targets:
  - `make deploy-migrations` — `supabase db push --db-url <prod>`.
  - `make deploy-functions` — `supabase functions deploy --project-ref <prod>` for each function.
- **ADDED** EAS production configuration:
  - Apple Developer team setup, provisioning, App Store Connect app record.
  - Android keystore generated and committed (encrypted via EAS secret).
  - `make build-prod` produces signed iOS .ipa and Android .aab.
  - TestFlight upload via `eas submit --profile production --platform ios`.
  - Internal distribution APK shared via EAS-hosted URL for Android.
- **ADDED** Backup Edge Function `weekly-backup`:
  - Reads pg_dump output (via direct connection to Supabase — service role).
  - Uploads to Backblaze B2 bucket.
  - Schedule via pg_cron weekly (Sunday 02:00 Berlin).
- **ADDED** `docs/runbook.md`:
  - "How to roll back a migration" — drop function/table or run a down-migration.
  - "How to invite a servant" — admin uses in-app invite UI.
  - "How to handle a right-to-erasure request" — admin uses the GDPR Article 17 hard-erasure path on the Admin Compliance screen (introduced in `add-gdpr-compliance`), NOT the general-churn soft-delete; documented backup-retention implications (Supabase 7d + B2 90d) and the procedure for expediting backup removal if legally required.
  - "How to verify backups" — restore drill checklist.
  - "How to update the app" — bump version, build, submit.
- **ADDED** `docs/incident-response.md` — basic outage triage steps.
- **ADDED** Version bump to `1.0.0` in `app.json`.
- **ADDED** Final environment variables verification checklist in `.env.production` — all required vars present, secrets in EAS / Supabase Edge Function secrets (never committed).

## Impact

- **Affected specs**: `dev-tooling` (modified — adds prod deployment).
- **Affected code**: Makefile real implementations, new docs, new Edge Function, EAS config.
- **Breaking changes**: deploying to production is a new operation; no existing prod state.
- **Migration needs**: production-only — runs the existing migrations against the new project.
- **Expo Go compatible**: no — production builds.
- **Uses design system**: yes — production assets are themed via the design system already established. Splash, icons, About content all consume tokens.
- **Dependencies**: `replace-mock-with-real-push`, `prepare-store-listings`, `add-gdpr-compliance`, `add-brand-assets`.
