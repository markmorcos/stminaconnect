# Production Setup — first-time walkthrough

This is the one-time setup to get a clean Supabase project and EAS build pipeline ready for `stminaconnect.com`. After this, ongoing ops live in `docs/runbook.md` and outages in `docs/incident-response.md`.

The current production project is **`hdcwafpagxujovqivzzz`** (`eu-central-1` / Frankfurt). The values in this doc are templates — substitute your project ref and keys.

## 1. Create the Supabase project

1. <https://supabase.com/dashboard/projects> → **New project**.
2. Region: `eu-central-1` (Frankfurt). Pricing tier: Free is fine for v1 (parish-scale row counts, well below caps).
3. Strong DB password — save it in 1Password / Bitwarden, not in the repo.
4. Wait ~2 min for provisioning.
5. Copy from **Settings → API**:
   - Project Ref (`hdcwafpagxujovqivzzz` for the live one)
   - Project URL (`https://<ref>.supabase.co`)
   - `anon` key (public, fine to commit in `eas.json`)
   - `service_role` key (secret, keep in 1Password — used only for backups + admin ops)

## 2. Link the local repo to the project

```bash
supabase link --project-ref <ref>
# enter the DB password when prompted
```

State persists under `supabase/.temp/`. Re-link only when switching ref.

## 3. Enable required extensions

Dashboard → **Database → Extensions** → enable:

- `pg_cron` — schedules the calendar sync + weekly backup.
- `pg_net` — HTTP client used by the cron jobs to call Edge Functions.
- `supabase_vault` — already enabled on hosted projects; verify.

## 4. Configure Auth

Dashboard → **Authentication**.

- **Providers → Email**: enable; **disable Sign-up** (members don't sign up; servants are invited via the admin UI).
- **URL Configuration**:
  - Site URL: `stminaconnect://auth/callback`
  - Redirect URLs allow-list: `stminaconnect://auth/callback`. Do not add localhost or preview-scheme entries — those belong on the preview project only.
- **Emails**: configure **Custom SMTP** (Settings → Authentication → SMTP Settings) pointing at Resend so the magic-link `From:` is `no-reply@stminaconnect.com` and the rate limit isn't 2/hour. See § "SMTP via Resend" in `docs/runbook.md` for the values.
- **Rate Limits**: bump `Send emails` to 30/hour or higher (the default 2/hour is unusable in practice).

## 5. Run the migrations

The CI workflow at `.github/workflows/deploy-supabase.yml` is the canonical deploy path — pushing a migration to `main` deploys it to preview, then prompts for prod approval. For first-time setup you can also run locally:

```bash
make deploy-migrations PROJECT=prod
# confirms before touching prod, then runs `supabase db push`
```

After the run, in Supabase Dashboard → **Database → Migrations** you should see all 42 migrations applied (the latest is `042_pg_cron_weekly_backup`).

## 6. Deploy the Edge Functions

Same pattern — CI is canonical, Makefile is for local debugging:

```bash
make deploy-functions PROJECT=prod
```

This deploys: `sync-calendar-events`, `send-push-notification`, `detect-absences`, `invite-servant`, `delete-auth-user`, `weekly-backup`.

Verify in Dashboard → **Edge Functions** that all six are listed and enabled.

## 7. Set Edge Function secrets

```bash
# Google Calendar service account JSON (single-line)
supabase secrets set GOOGLE_SERVICE_ACCOUNT_KEY="$(cat secrets/google-calendar-sa.json | jq -c)" --project-ref <ref>

# Calendar id from `docs/google-calendar-setup.md`
supabase secrets set GOOGLE_CALENDAR_ID="<calendar-id>@group.calendar.google.com" --project-ref <ref>

# Backblaze B2 — for weekly-backup
supabase secrets set BACKBLAZE_KEY_ID="<key-id>" --project-ref <ref>
supabase secrets set BACKBLAZE_APP_KEY="<app-key>" --project-ref <ref>
supabase secrets set BACKBLAZE_BUCKET_ID="<bucket-id>" --project-ref <ref>
supabase secrets set BACKBLAZE_BUCKET_NAME="<bucket-name>" --project-ref <ref>

# Expo Push — sending uses the bare Expo Push API, no service-account
# key needed; `send-push-notification` reads recipient tokens from the
# `expo_push_tokens` table at dispatch time.
```

`DATABASE_URL` is auto-populated by Supabase to every Edge Function.

## 8. Wire the Vault secrets for cron schedules

The `pg_cron` migrations (`013_pg_cron_sync_calendar.sql`, `042_pg_cron_weekly_backup.sql`) read function URLs and tokens from `vault.decrypted_secrets`. Populate them once:

```sql
-- in Supabase Dashboard → SQL Editor on the prod project
select vault.create_secret('https://<ref>.supabase.co/functions/v1/sync-calendar-events',  'sync_calendar_function_url');
select vault.create_secret('<service-role-key>',                                            'sync_calendar_service_role_key');
select vault.create_secret('https://<ref>.supabase.co/functions/v1/send-push-notification', 'send_push_function_url');
select vault.create_secret('<service-role-key>',                                            'send_push_service_role_key');
select vault.create_secret('https://<ref>.supabase.co/functions/v1/weekly-backup',          'weekly_backup_function_url');
select vault.create_secret('<service-role-key>',                                            'weekly_backup_service_role_key');
```

Then activate the schedules:

```sql
select public.schedule_calendar_sync(
  (select decrypted_secret from vault.decrypted_secrets where name = 'sync_calendar_function_url'),
  (select decrypted_secret from vault.decrypted_secrets where name = 'sync_calendar_service_role_key')
);
select public.schedule_weekly_backup(
  (select decrypted_secret from vault.decrypted_secrets where name = 'weekly_backup_function_url'),
  (select decrypted_secret from vault.decrypted_secrets where name = 'weekly_backup_service_role_key')
);
```

Verify with `select * from cron.job` — both jobs should be listed.

## 9. EAS production builds

`eas.json`'s `production` profile already has the prod Supabase URL + anon key + `EXPO_PUBLIC_NOTIFICATION_DISPATCHER=real`. The `submit.production.{ios,android}` blocks have placeholders — fill them in once Apple Dev / Play Console accounts are usable:

```json
"submit": {
  "production": {
    "ios": { "appleId": "<email>", "ascAppId": "<numeric>", "appleTeamId": "<10-char>" },
    "android": { "serviceAccountKeyPath": "./secrets/play-service-account.json", "track": "internal" }
  }
}
```

Then:

```bash
make build-prod                 # both platforms, with confirmation
eas submit -p ios  --profile production --latest    # → TestFlight
eas submit -p android --profile production --latest # → Play internal track
```

Per-platform submission docs: `docs/store/submission-ios.md`, `docs/store/submission-android.md`.

**Currently blocked**: Apple Developer enrolment is deferred (no Apple for v1) and the Play developer account is closed for inactivity (refund + reactivation in flight). Both unblock independently of this runbook.

## 10. Verify

Smoke-test checklist (also lives in `prepare-store-listings/tasks.md` § 8):

- [ ] Sign in to a fresh production install with a real servant credential → reach home → all flows work.
- [ ] Trigger an absence detection in production → real OS notification arrives.
- [ ] `curl -X POST -H "Authorization: Bearer <service-role>" https://<ref>.supabase.co/functions/v1/weekly-backup` → object lands in B2.
- [ ] Supabase Logs Explorer → no error spam.
- [ ] First-launch consent flow blocks until accepted.
- [ ] `curl -I https://stminaconnect.com/{,privacy,terms,ar/,de/}` → all 200.
- [ ] `curl -I https://stminaconnect.com/{ar,de}/{privacy,terms}` → all 200.
