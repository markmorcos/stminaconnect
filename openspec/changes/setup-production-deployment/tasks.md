# Tasks — setup-production-deployment

## 1. Production Supabase project

- [ ] 1.1 Create new Supabase project in `eu-central-1` (Frankfurt).
- [ ] 1.2 Note project ref, anon key, service-role key.
- [ ] 1.3 `supabase link --project-ref <ref>` from local repo.
- [ ] 1.4 Configure Auth: enable email/password + magic link; disable sign-up; set redirect allow-list to production scheme.
- [ ] 1.5 Enable `pg_cron` and `pg_net` extensions in production project settings.

## 2. Migrations + Edge Functions

- [ ] 2.1 Implement real `make deploy-migrations` (loops `supabase db push`).
- [ ] 2.2 Implement real `make deploy-functions` (loops over function dirs and deploys each).
- [ ] 2.3 Run `make deploy-migrations` against production; verify schema.
- [ ] 2.4 Run `make deploy-functions` against production.

## 3. Secrets

- [ ] 3.1 `supabase secrets set GOOGLE_SERVICE_ACCOUNT_KEY=...`
- [ ] 3.2 `supabase secrets set GOOGLE_CALENDAR_ID=...`
- [ ] 3.3 `supabase secrets set BACKBLAZE_*` for backup function.
- [ ] 3.4 `supabase secrets set EXPO_PUSH_*` if any (the Expo Push API uses tokens, no key needed; verify).

## 4. Backup function

- [ ] 4.1 `supabase/functions/weekly-backup/index.ts`: `pg_dump` via direct connection to Supabase, upload to B2.
- [ ] 4.2 `pg_cron` schedule weekly Sunday 02:00 Berlin.
- [ ] 4.3 Manual run + verify B2 object exists.

## 5. EAS production

- [ ] 5.1 Apple Developer team enrolment + App Store Connect app record + internal testers added (per `docs/store/submission-ios.md` from `prepare-store-listings`).
- [ ] 5.2 `eas.json` production profile: Supabase URL/anon key for prod; dispatcher=`real`. Confirm submit profiles wired in `prepare-store-listings`.
- [ ] 5.3 `eas credentials` configured for both platforms.
- [ ] 5.4 `make build-prod` succeeds; produces signed .ipa and .aab using final brand assets (icons, splash) from `add-brand-assets`.
- [ ] 5.5 Upload App Store metadata: name, subtitle, description, keywords (EN/AR/DE) from `docs/store/listings/`; screenshots from `assets/store/screenshots-framed/ios/`; Privacy nutrition label from `docs/store/ios-privacy-label-final.md`; Privacy Policy and Terms URLs.
- [ ] 5.6 Upload Play Console metadata: short and full descriptions (EN/AR/DE), screenshots from `assets/store/screenshots-framed/android/`, content rating from `docs/store/age-rating.md`, data safety form mirroring iOS Privacy nutrition label, Privacy Policy URL.
- [ ] 5.7 `eas submit --profile production --platform ios` to TestFlight.
- [ ] 5.8 `eas submit --profile production --platform android --track internal` to Play Console internal testing.
- [ ] 5.9 Verify submissions appear in App Store Connect / Play Console with all metadata populated.
- [ ] 5.10 Optionally: build a `--profile preview --platform android` for direct APK distribution outside Play Console.

## 6. Version bump

- [ ] 6.1 Bump `app.json` version from `0.99.0` → `1.0.0`.
- [ ] 6.2 Tag the commit `v1.0.0` in git.

## 7. Documentation

- [ ] 7.1 `docs/production-setup.md`: full first-time setup walk-through.
- [ ] 7.2 `docs/runbook.md`: ongoing ops.
- [ ] 7.3 `docs/incident-response.md`: triage guides.
- [ ] 7.4 README updated: production link + TestFlight link + APK URL.

## 8. Verification

- [ ] 8.1 Sign in to TestFlight build with a real servant credential → reach home → all flows work.
- [ ] 8.2 Sign in to Android APK same as above.
- [ ] 8.3 Trigger an absence detection in production → real OS notification arrives.
- [ ] 8.4 Manually invoke `weekly-backup` → confirm B2 object.
- [ ] 8.5 Open Supabase Logs Explorer → no error spam.
- [ ] 8.6 GDPR: perform a hard-erasure (Article 17) in production → verify person row gone, attendance anonymized, audit log row recorded; document the backup-retention implication (Supabase 7d + B2 90d) in `docs/runbook.md` § Right-to-Erasure.
- [ ] 8.7 First-launch consent flow blocks until accepted on a fresh production install.
- [ ] 8.8 Privacy Policy and Terms URLs respond with 200 in EN/AR/DE.
- [ ] 8.9 App Store Connect listing complete: all metadata fields, screenshots, privacy label, age rating set; submission state is "Ready to Submit".
- [ ] 8.10 Play Console listing complete: descriptions, screenshots, content rating, data safety, distribution.
- [ ] 8.11 `openspec validate setup-production-deployment` passes.
