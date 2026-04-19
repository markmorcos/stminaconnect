## 1. Hosted Supabase project

- [ ] 1.1 Create a new Supabase project in the EU (Frankfurt) region named `stminaconnect-prod`
- [ ] 1.2 Enable daily backups and point-in-time recovery in project settings
- [ ] 1.3 Generate anon and service role keys; store service role key in password manager (never in repo)
- [ ] 1.4 Link local repo via `supabase link --project-ref <ref>`; commit the resulting project ref to `docs/deployment.md` (public info) but NOT the access token
- [ ] 1.5 Apply all prior migrations: `make deploy-migrations env=production`
- [ ] 1.6 Seed the `app_config` row with production values (church phone, email, calendar ID, timezone = Europe/Berlin)

## 2. Edge Functions + secrets

- [ ] 2.1 Deploy all Edge Functions: `make deploy-functions env=production`
- [ ] 2.2 Set function secrets in Supabase dashboard: `GOOGLE_SA_EMAIL`, `GOOGLE_SA_PRIVATE_KEY`, `GOOGLE_CALENDAR_ID`, `SENTRY_DSN_EDGE`, `EXPO_ACCESS_TOKEN`
- [ ] 2.3 Verify cron schedules are registered (`SELECT * FROM cron.job`): hourly calendar sync, nightly absence detection, push-dispatch cadence

## 3. GitHub Actions CI

- [ ] 3.1 Create `.github/workflows/ci.yml` triggered on `pull_request` and `push: main`
- [ ] 3.2 Steps: checkout → setup-node@22 → `npm ci` → `make typecheck` → `make lint` → `make test` → `openspec validate --all`
- [ ] 3.3 Use `services: postgres` (with Supabase image or plain Postgres + migrations) for integration tests
- [ ] 3.4 Cache npm and Expo caches keyed on `package-lock.json`
- [ ] 3.5 Fail the job on any step failure; do not allow merges without green CI (document branch protection)
- [ ] 3.6 Add `openspec` job running on every PR that references an `openspec/changes/**` path

## 4. EAS Build configuration

- [ ] 4.1 Create `eas.json` with `preview` and `production` profiles
- [ ] 4.2 `preview`: distribution `internal`, TestFlight internal + APK output, env points at production Supabase, `EXPO_PUBLIC_UAT_BANNER=true`
- [ ] 4.3 `production`: distribution `store`, TestFlight external + Play internal; `EXPO_PUBLIC_UAT_BANNER=false`
- [ ] 4.4 Configure EAS secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SENTRY_DSN`, `EXPO_ACCESS_TOKEN`
- [ ] 4.5 Run a first `eas build --profile preview --platform ios` and `--platform android` and verify install on a real device
- [ ] 4.6 Configure EAS Submit for TestFlight (iOS) and Play internal (Android)

## 5. Deploy scripts + Makefile

- [ ] 5.1 Add `scripts/deploy-migrations.sh` that: checks `SUPABASE_ACCESS_TOKEN` is set, confirms target project ref, prints dry-run summary (`supabase db diff`), prompts "yes/no", then runs `supabase db push`
- [ ] 5.2 Add `scripts/deploy-functions.sh` that: lists functions to deploy, prompts confirmation, deploys each via `supabase functions deploy <name>`
- [ ] 5.3 Wire both into the Makefile: `deploy-migrations env=production`, `deploy-functions env=production`
- [ ] 5.4 Makefile targets fail fast if `env` is not `production` and no other value is supported in v1 (single-env reality)

## 6. Environment templates

- [ ] 6.1 Add `.env.production.example` listing only PUBLIC vars (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_UAT_BANNER`, `EXPO_PUBLIC_SENTRY_DSN`)
- [ ] 6.2 Update `.env.example` (dev) to clarify it is for local Supabase only; production secrets NEVER in .env files
- [ ] 6.3 Add a `README.md` note: "Production secrets live in Supabase dashboard + EAS secrets. Never copy them locally."

## 7. Runbook

- [ ] 7.1 Create `docs/runbook.md` with sections:
  - Rotating Google service account keys (revoke old, create new, update `GOOGLE_SA_PRIVATE_KEY` secret, verify next cron tick succeeds)
  - Rotating Supabase service role key (generate new in dashboard, update EAS + workflow secrets, deploy)
  - Rotating Expo push credentials
  - Rolling back a migration (`down.sql` siblings for reversible; PITR restore for unsafe)
  - Pausing cron jobs (`SELECT cron.unschedule(jobid)`)
  - Toggling read-only mode (`UPDATE app_config SET read_only = true`)
  - Investigating a Sentry incident — where to look, who to page
  - Dead push-token purge (already automatic; manual trigger documented)

## 8. First-admin bootstrap

- [ ] 8.1 Document in `docs/deployment.md`:
  1. Priest visits Supabase Studio → Auth → Users → Invite user (their email)
  2. Priest receives magic link, signs in to the app once to create their profile row
  3. Admin runs the SQL snippet provided in the doc: `UPDATE public.profiles SET role = 'admin' WHERE email = '<priest@email>'`
  4. Priest reopens the app; admin affordances unlock
- [ ] 8.2 Put the SQL snippet in `scripts/bootstrap-first-admin.sql` so it is versioned

## 9. App store assets (prepared, not submitted)

- [ ] 9.1 `app-store-assets/descriptions/{en,ar,de}.md` — short (80 char) + long descriptions
- [ ] 9.2 Icon source at 1024x1024 PNG; generate required sizes via EAS
- [ ] 9.3 3–5 screenshots per language (EN/AR/DE) on required iPhone + Android sizes; include UAT banner-OFF builds for store screenshots
- [ ] 9.4 Privacy policy and terms URLs added to `app-store-assets/metadata.md` (privacy policy required by Apple/Google)
- [ ] 9.5 Data safety questionnaire answers drafted for Play Console in `app-store-assets/data-safety.md`

## 10. Pre-launch verification

- [ ] 10.1 Install preview build on priest's device; priest completes full UAT: register newcomer (Quick + Full), mark attendance, check dashboards, trigger a follow-up, toggle language
- [ ] 10.2 Verify Sentry receives a test error from a production build
- [ ] 10.3 Verify absence detection runs: insert test person, skip 2 counted events, confirm alert appears and push is delivered
- [ ] 10.4 Verify offline queue: airplane-mode the device, mark 5 attendances, back online, confirm sync
- [ ] 10.5 Cut the v1.0.0 tag only after priest signs off in writing
