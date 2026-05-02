# Production Runbook

Ongoing operational tasks for the live `stminaconnect.com` deployment. First-time setup lives in `docs/production-setup.md`; outage triage in `docs/incident-response.md`.

## How to invite a servant

In-app, signed in as an admin (priest):

1. Settings → Servants → **Invite servant**.
2. Enter their email address. The Edge Function `invite-servant` is invoked, which calls Supabase Auth's admin API to create the user, sends them a magic-link email, and creates a corresponding `servants` row with role `servant`.
3. New servant clicks the email link → app opens → first-launch consent → home.

If the magic-link email never arrives:

- Check Resend dashboard → **Logs**. If the email shows as bounced / blocked, the recipient's mailbox refused it (typo, spam filter).
- Check Supabase Auth → Users → the new row exists but `email_confirmed_at` is null → Resend the magic link via the in-app "Re-invite" button.

## How to run a Right-to-Erasure (GDPR Article 17)

The canonical erasure mechanism is the in-app **Admin Compliance** screen (introduced in `add-gdpr-compliance`). This is **distinct** from the soft-delete on the person profile, which is for "this member is no longer attending" general churn.

1. Sign in as admin → Settings → **Compliance**.
2. Find the person → "Erase data".
3. Type the confirmation phrase (`Erase <Full Name>`) exactly. Provide a free-text reason (≥ 20 chars; a court order, a member's written request, etc.).
4. Click Erase.

What happens server-side:

- The `persons` row is **deleted** (not soft-deleted — actually removed).
- All `attendance` rows for the person have `person_id` set to NULL and `was_anonymized=true`. Aggregate stats still count them; per-person views exclude them.
- All `follow_ups` and `notifications` rows referencing the person are deleted.
- An `audit_log` row is recorded with `action='member.erase'`, the actor's id, the reason, and the timestamp.

### Backup-retention implication

Erased data persists in:

- **Supabase native daily backups** — 7-day retention on free tier.
- **Backblaze B2 weekly snapshots** — 90-day retention (set on the bucket).

Until those retention windows expire, the erased rows are still recoverable from backup. This is **legally fine for most jurisdictions** because:

- Article 17 (GDPR) recognises that backup retention is a "legitimate technical reason" for delayed erasure as long as the data isn't actively used.
- The audit log is permanent; the erasure event is itself logged.

For requests where the requestor specifically asks for backup removal:

1. **Supabase backups**: file a support ticket via the Dashboard → Help → "Compliance" → request a manual backup purge. Supabase handles this on a per-request basis. Allow 5-10 business days.
2. **Backblaze B2 backups**: list the objects under `weekly-backup/` covering the relevant time window, delete via the B2 Console or `b2 delete-file-version`. Document the deletion in the original audit-log row's `payload.backup_purged_at`.

## How to verify backups (quarterly drill)

Once per quarter, prove the backup is restorable:

1. Pick the most recent `weekly-backup/<date>-<unix>.json.gz` from B2.
2. Download to a scratch directory: `b2 download-file-by-name <bucket> weekly-backup/<key> /tmp/backup.json.gz`.
3. `gunzip /tmp/backup.json.gz` → should produce a JSON file > 1 KB.
4. `jq '.tables | keys' /tmp/backup.json` → should list every public-schema table (`servants`, `persons`, `events`, `attendance`, `notifications`, `follow_ups`, `absence_alerts`, `consent`, `audit_log`, etc.).
5. Spot-check a known row: `jq '.tables.servants[] | select(.email == "<a-known-servant-email>")' /tmp/backup.json` should print one row.

If any of those fail, the backup function is broken — open `supabase/functions/weekly-backup/` and investigate. Most common cause: B2 credentials rotated and `BACKBLAZE_*` Edge Function secrets stale.

## How to update the app version

After merging a release-eligible set of changes to `main`:

1. Bump `app.json` `expo.version` per semver (1.0.0 → 1.0.1 for fixes, 1.1.0 for features).
2. Commit + tag:
   ```bash
   git commit -am "chore: bump version to 1.0.1"
   git tag v1.0.1
   git push --tags
   ```
3. CI (`.github/workflows/build-mobile.yml`) builds preview/prod artifacts. Production builds require manual approval gate.
4. After approval: `eas submit -p android --profile production --latest` (Play) and / or `eas submit -p ios --profile production --latest` (TestFlight).

## SMTP via Resend (current production setup)

Magic-link auth ships from `no-reply@stminaconnect.com` via Resend SMTP. Configured in **Supabase Dashboard → Authentication → SMTP Settings**:

```
Host:         smtp.resend.com
Port:         465
Username:     resend
Password:     <re_… key from Resend dashboard>
Sender email: no-reply@stminaconnect.com
Sender name:  St. Mina Connect
```

Domain is verified in Resend with DKIM + SPF + return-path records on Cloudflare DNS. Re-do verification if any of those records change.

**Inbound** mail to `support@stminaconnect.com` and `privacy@stminaconnect.com` is routed to the developer's personal inbox via Cloudflare Email Routing. Outbound from those addresses isn't configured — replies that need to come _from_ support@ are typed manually in the developer's mail client (Gmail's "Send mail as" or similar).

## How to roll back a migration

Migrations are forward-only by default. There is no `down` migration generator in our setup. To revert:

1. Identify the migration to revert (`supabase/migrations/0NN_name.sql`).
2. Hand-write a new migration `0(NN+1)_revert_name.sql` that undoes the schema changes. Drop columns / drop functions / restore old definitions.
3. Apply the new migration via the normal CI deploy or `make deploy-migrations PROJECT=prod`.

**Do not edit historic migrations**. The CI deploy uses a checksum to track which migrations have been applied; editing breaks the checksum and the deploy fails or produces inconsistent state.

## How to rotate Supabase service-role key

Required if the key is leaked or quarterly as routine hygiene:

1. Dashboard → Settings → API → **Reset service role key** → confirm.
2. Update Edge Function secrets that reference it: `supabase secrets set` for any function using it (none in v1; the Edge Functions read `DATABASE_URL` directly, not the service key).
3. Update Vault entries used by `pg_cron` schedules:
   ```sql
   select vault.update_secret('sync_calendar_service_role_key', '<new-key>');
   select vault.update_secret('send_push_service_role_key',     '<new-key>');
   select vault.update_secret('weekly_backup_service_role_key', '<new-key>');
   select public.schedule_calendar_sync((select decrypted_secret from vault.decrypted_secrets where name='sync_calendar_function_url'), '<new-key>');
   select public.schedule_weekly_backup((select decrypted_secret from vault.decrypted_secrets where name='weekly_backup_function_url'), '<new-key>');
   ```
4. Update any local CLI usage (rare; the CLI uses the access token, not the service role).

## Cluster ops (marketing site)

The marketing site at `stminaconnect.com` deploys via the personal Raspberry Pi cluster — see the project's deployment infrastructure pattern (`markmorcos/infrastructure` Helm chart 0.4.7 + central dispatcher). Pushing under `marketing/**` triggers `deploy-stminaconnect` automatically.

To redeploy without code changes (e.g. force a cert renewal): `gh workflow run deploy-marketing.yml --repo markmorcos/stminaconnect`.

To check the rendered legal pages match the source markdown after a `docs/legal/*.md` edit: re-run `deno task render-legal` from `marketing/`, commit the rendered HTML, push.
