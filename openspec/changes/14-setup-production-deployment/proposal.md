## Why

We have a feature-complete, hardened app working against local Supabase. Shipping requires a hosted Supabase project, Edge Functions deployed, build profiles for TestFlight + internal APK distribution, CI to keep `main` green, and a documented runbook. This change moves us from "works on my laptop" to "available to the servants".

## What Changes

- **ADDED** `deployment` capability:
  - Hosted Supabase project in EU (Frankfurt) region created and documented.
  - GitHub Actions CI: on every PR, run `make typecheck`, `make lint`, `make test`, `openspec validate --all`.
  - EAS Build profiles: `preview` (internal distribution) and `production` (TestFlight + Play Store internal).
  - Deployment Makefile targets wired to hosted project.
  - Production env template and secret management documented.
  - Runbook: how to rotate Google service account, Supabase keys, Expo push credentials; what to check during an incident; how to roll back a migration.
  - App Store / Play Store listing assets prepared (icon, screenshots, short/long description in EN/AR/DE) — content only, no submission in this change.
  - First admin bootstrap documented: priest creates their account via Supabase Studio, then uses the app to invite others.
- **MODIFIED** `setup`: env var handling tightened; `.env.production.example` added; docs updated.

## Impact

- **Affected specs:** `deployment` (new), `setup` (MODIFIED)
- **Affected code (preview):**
  - `.github/workflows/ci.yml`
  - `eas.json` (EAS Build config)
  - `docs/deployment.md`, `docs/runbook.md`
  - `scripts/deploy-functions.sh`, `scripts/deploy-migrations.sh`
  - `app-store-assets/` — text + image stubs
- **Breaking changes:** none functionally.
- **Migration needs:** apply all prior migrations to the hosted project; documented process.
- **Depends on:** all prior changes — this is the final gate.
