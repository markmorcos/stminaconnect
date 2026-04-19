## MODIFIED Requirements

### Requirement: Environment variable handling

The repo SHALL ship two env templates: `.env.example` (local development against local Supabase) and `.env.production.example` (production builds, PUBLIC vars only). Both templates SHALL be committed. Real `.env*` files SHALL be gitignored. Production secrets (Supabase service role key, Google service account JSON, Sentry DSN, Expo access token) SHALL NEVER be copied into a local `.env` file; they live only in Supabase dashboard secrets and EAS Build secrets.

#### Scenario: Templates exist and differ

- **GIVEN** a fresh checkout
- **WHEN** a developer lists the repo root
- **THEN** `.env.example` and `.env.production.example` both exist
- **AND** `.env.production.example` contains only keys prefixed `EXPO_PUBLIC_`
- **AND** `.env.example` may contain additional local-only keys (e.g., `SUPABASE_SERVICE_ROLE_KEY` pointing at the local Supabase instance)

#### Scenario: Gitignore blocks real env files

- **GIVEN** a developer creates `.env` or `.env.production` locally
- **WHEN** they run `git status`
- **THEN** neither file appears as tracked or trackable

### Requirement: Makefile deploy targets

The Makefile SHALL provide `deploy-migrations` and `deploy-functions` targets that require `env=production` and execute via `scripts/deploy-migrations.sh` and `scripts/deploy-functions.sh` respectively. These scripts SHALL require `SUPABASE_ACCESS_TOKEN`, print a dry-run summary, and prompt the operator for explicit `yes` confirmation before proceeding.

#### Scenario: Running deploy-migrations without env fails

- **GIVEN** a developer runs `make deploy-migrations` (no `env=` arg)
- **WHEN** make resolves the target
- **THEN** it exits non-zero with a message "usage: make deploy-migrations env=production"
