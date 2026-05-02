# Tasks — setup-production-deployment

## 1. Production Supabase project

- [x] 1.1 Create new Supabase project in `eu-central-1` (Frankfurt). _Live at ref `hdcwafpagxujovqivzzz`._
- [x] 1.2 Note project ref, anon key, service-role key. _Anon key wired into `eas.json` production profile; service-role key in 1Password._
- [x] 1.3 `supabase link --project-ref <ref>` from local repo. _CI does this every deploy via `supabase/setup-cli@v1` + `supabase link`. Local link state under `supabase/.temp/`._
- [x] 1.4 Configure Auth: magic-link only (no email/password — disabled at the Supabase project level per the `magic-link-only-auth` change); sign-up disabled; redirect allow-list scoped to `stminaconnect://auth/callback`. SMTP routed through Resend (`no-reply@stminaconnect.com`).
- [x] 1.5 Enable `pg_cron` and `pg_net` extensions in production project settings. _Required for the migration `013_pg_cron_sync_calendar.sql` and `042_pg_cron_weekly_backup.sql`._

## 2. Migrations + Edge Functions

- [x] 2.1 Implement real `make deploy-migrations` (loops `supabase db push`). _Wraps `supabase link` + `supabase db push`; gated behind a `PROJECT=preview|prod` argument with an explicit confirmation when targeting prod._
- [x] 2.2 Implement real `make deploy-functions` (loops over function dirs and deploys each). _Iterates `SUPABASE_FUNCTIONS` (kept in sync with the CI workflow's `FUNCTIONS` env)._
- [x] 2.3 Run `make deploy-migrations` against production; verify schema. _Routine via CI on every push under `supabase/migrations/**`; the workflow's prod stage gates on a manual approval._
- [x] 2.4 Run `make deploy-functions` against production. _Same CI workflow handles `supabase functions deploy` for each name in `FUNCTIONS`._

## 3. Secrets

- [x] 3.1 `supabase secrets set GOOGLE_SERVICE_ACCOUNT_KEY=...` _Set during `add-google-calendar-sync` rollout; documented in `docs/google-calendar-setup.md`._
- [x] 3.2 `supabase secrets set GOOGLE_CALENDAR_ID=...`
- [x] 3.3 `supabase secrets set BACKBLAZE_*` for backup function. _Required keys: `BACKBLAZE_KEY_ID`, `BACKBLAZE_APP_KEY`, `BACKBLAZE_BUCKET_ID`, `BACKBLAZE_BUCKET_NAME` per `weekly-backup/index.ts`._
- [x] 3.4 `supabase secrets set EXPO_PUSH_*` if any (the Expo Push API uses tokens, no key needed; verify). _Confirmed: no extra secret needed; `send-push-notification` reads device tokens from `expo_push_tokens` and POSTs to `exp.host/--/api/v2/push/send` with the public Expo URL._

## 4. Backup function

- [x] 4.1 `supabase/functions/weekly-backup/index.ts`: logical JSON snapshot of the public schema via the postgres connection, gzipped, uploaded to Backblaze B2 via the native B2 API. _Trade-off vs `pg_dump` documented in the function header — Edge Runtime has no `pg_dump` binary; for a true plain-text dump alongside this snapshot, the runbook describes a GitHub-Actions cron pattern._
- [x] 4.2 `pg_cron` schedule weekly Sunday 02:00 Berlin. _Migration `042_pg_cron_weekly_backup.sql` adds `public.schedule_weekly_backup(url, key)`; cron runs at `0 1 * * 0` UTC ≈ 02:00 Berlin in winter / 03:00 in summer (close enough for off-hours)._
- [ ] 4.3 Manual run + verify B2 object exists.

## 5. EAS production

- [ ] 5.1 Apple Developer team enrolment + App Store Connect app record + internal testers added (per `docs/store/submission-ios.md` from `prepare-store-listings`). _Deferred — "no Apple for v1" per the prepare-store-listings decision; iOS docs ready to follow when enrolment lands._
- [x] 5.2 `eas.json` production profile: Supabase URL/anon key for prod; dispatcher=`real`. Confirm submit profiles wired in `prepare-store-listings`. _Both prod env vars set; submit blocks for both platforms have placeholders waiting on Apple/Play credentials._
- [ ] 5.3 `eas credentials` configured for both platforms. _iOS waits on Apple enrolment; Android keystore is generated automatically by EAS on first prod build._
- [ ] 5.4 `make build-prod` succeeds; produces signed .ipa and .aab using final brand assets (icons, splash) from `add-brand-assets`. _Will run once Play account is reactivated (Android) and Apple Dev is enrolled (iOS)._
- [ ] 5.5 Upload App Store metadata: name, subtitle, description, keywords (EN/AR/DE) from `docs/store/listings/`; screenshots from `assets/store/screenshots-framed/ios/`; Privacy nutrition label from `docs/store/ios-privacy-label-final.md`; Privacy Policy and Terms URLs. _All artifacts staged in the repo; deferred per Apple decision._
- [ ] 5.6 Upload Play Console metadata: short and full descriptions (EN/AR/DE), screenshots from `assets/store/screenshots-framed/android/`, content rating from `docs/store/age-rating.md`, data safety form mirroring iOS Privacy nutrition label, Privacy Policy URL. _All artifacts staged; blocked on Play account reactivation._
- [ ] 5.7 `eas submit --profile production --platform ios` to TestFlight.
- [ ] 5.8 `eas submit --profile production --platform android --track internal` to Play Console internal testing.
- [ ] 5.9 Verify submissions appear in App Store Connect / Play Console with all metadata populated.
- [ ] 5.10 Optionally: build a `--profile preview --platform android` for direct APK distribution outside Play Console. _Interim distribution path while the Play account is recovered — README documents this._

## 6. Version bump

- [x] 6.1 Bump `app.json` version from `0.99.0` → `1.0.0`.
- [ ] 6.2 Tag the commit `v1.0.0` in git. _Run `git tag v1.0.0 && git push --tags` after the prod-deploy commit lands; held until the cluster of prod-related tasks settles so the tag points at a self-contained release commit._

## 7. Documentation

- [x] 7.1 `docs/production-setup.md`: full first-time setup walk-through.
- [x] 7.2 `docs/runbook.md`: ongoing ops.
- [x] 7.3 `docs/incident-response.md`: triage guides.
- [x] 7.4 README updated: production link + TestFlight link + APK URL.

## 8. Verification

- [ ] 8.1 Sign in to TestFlight build with a real servant credential → reach home → all flows work. _Deferred per Apple decision._
- [ ] 8.2 Sign in to Android APK same as above. _Verified on the preview APK (preview Supabase project); awaiting prod Android build for the prod Supabase project verification._
- [ ] 8.3 Trigger an absence detection in production → real OS notification arrives.
- [ ] 8.4 Manually invoke `weekly-backup` → confirm B2 object.
- [ ] 8.5 Open Supabase Logs Explorer → no error spam.
- [ ] 8.6 GDPR: perform a hard-erasure (Article 17) in production → verify person row gone, attendance anonymized, audit log row recorded; document the backup-retention implication (Supabase 7d + B2 90d) in `docs/runbook.md` § Right-to-Erasure. _Runbook section is in place; the in-production drill is held until the app is on real devices via Play._
- [ ] 8.7 First-launch consent flow blocks until accepted on a fresh production install.
- [x] 8.8 Privacy Policy and Terms URLs respond with 200 in EN/AR/DE. _Live at `https://stminaconnect.com/{,ar/,de/}{privacy,terms}` per the marketing-site deploy._
- [ ] 8.9 App Store Connect listing complete: all metadata fields, screenshots, privacy label, age rating set; submission state is "Ready to Submit". _Deferred per Apple decision._
- [ ] 8.10 Play Console listing complete: descriptions, screenshots, content rating, data safety, distribution. _Blocked on Play account reactivation._
- [x] 8.11 `openspec validate setup-production-deployment` passes.
