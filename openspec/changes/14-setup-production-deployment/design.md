## Context

Single-tenant deployment: one Supabase project for the one congregation. No staging environment in v1 — "preview" builds use the production backend because we are small enough that test users = real users performing UAT on non-destructive test data. This is explicitly tracked in `project.md` as revisitable.

## Goals

- `main` protected by CI; no red main ever.
- First servant can be onboarded via TestFlight / internal APK in < 30 minutes from a fresh check-out.
- Incident runbook is clear enough that a non-author can recover.
- No secret ever checked into git.

## Non-Goals

- No staging environment (see above).
- No multi-region failover.
- No automated production deploys on merge; deploys are manual via `make deploy-*`. (Manual gate because this is a church, not a startup — change velocity is deliberate.)
- No Play Store or App Store public submission in this change — that's the priest's decision after TestFlight UAT.

## Decisions

1. **GitHub Actions for CI**, run on every PR + push to main. Matrix on Node 22; single OS (ubuntu-latest). Docker support for integration tests via `services:` block.

2. **Secrets management**: Supabase secrets (service role key, Google service account JSON, Sentry DSN) live only in the hosted Supabase dashboard's secrets store and EAS Build's secrets. Never in `.env` files for production.

3. **EAS Build profiles**:
   - `preview` → internal APK + TestFlight internal; points at production Supabase (UAT path).
   - `production` → TestFlight external / Play Store internal; identical config minus build-number bumps handled by EAS automation.

4. **Makefile deploy targets**:
   - `make deploy-migrations env=production` runs `supabase db push` against the project linked via `supabase link`.
   - `make deploy-functions env=production` runs `supabase functions deploy <name> --project-ref ...`.
   - Both require explicit env var `SUPABASE_ACCESS_TOKEN` and a confirm prompt.

5. **Runbook**: markdown file covering: rotating Google SA keys, rotating Supabase service role, rolling back a migration (we use `down.sql` siblings for rollbackable migrations; unsafe migrations are called out and require manual restore from backup), pausing cron jobs, toggling the app into read-only mode in an emergency (feature flag in `app_config`).

6. **First-admin bootstrap**: documented one-time step in `docs/deployment.md` — priest signs up via Supabase Studio's Auth panel, then a SQL snippet updates their `profiles.role = 'admin'`.

7. **App store assets** prepared but not submitted: localized descriptions in EN/AR/DE, icons in required sizes, 3–5 screenshots per language.

## Risks / Trade-offs

- **Risk:** Preview pointing at production means UAT touches real data. Mitigation: a "UAT mode" flag surfaces a banner; admins delete any test records after UAT.
- **Risk:** Manual deploys have human-error risk. Mitigation: the Makefile targets prompt explicit confirmation and print a dry-run summary.
- **Trade-off:** No staging = leaner but riskier. Acceptable at our scale.

## Migration Plan

All prior migrations applied to hosted project via `make deploy-migrations env=production`. Backups enabled in Supabase project settings (daily). Rollback = restore from point-in-time backup if anything goes sideways.

## Open Questions

None blocking. Submission to public App Store / Play Store is a separate post-v1 decision.
