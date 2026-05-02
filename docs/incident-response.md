# Incident Response

First-five-minutes triage for the three outage shapes most likely in v1: **auth**, **sync**, **push**. Severity assessment, then jump to the matching playbook.

## Severity assessment (always start here)

1. **<https://status.supabase.com>** — global Supabase incident? If so, this is on Supabase's end. Communicate to users, wait. Nothing to do locally.
2. **<https://www.cloudflare.com/cdn-cgi/trace>** — DNS / CDN issue? Marketing site / privacy-policy URLs are Cloudflare-fronted; Auth flows are not.
3. **`curl -I https://hdcwafpagxujovqivzzz.supabase.co/rest/v1/`** with the anon key → 200 expected. Anything else means the project is down.
4. **GitHub Actions** — recent failed deploy? Check the latest `deploy-supabase` run. Failed migration mid-deploy can leave the schema half-applied.

If 1–4 all green, the issue is in our app or function code, not infrastructure.

## Auth outage — users can't sign in

Symptom: magic-link emails don't arrive, OR clicking a magic link spins forever, OR existing sessions get logged out.

**First five minutes:**

1. **Resend dashboard** → Logs. If the most recent magic-link emails show as failed/bounced, SMTP is broken. Check: API key not rotated, domain still verified, daily quota not hit (free tier = 100/day).
2. **Supabase Auth → Users** → request a magic link to your own address. If the email never sends, SMTP integration is broken. Toggle the "Custom SMTP" off-on or re-enter the API key.
3. **Supabase Logs Explorer** → filter for `auth.*` errors. Look for "Invalid Refresh Token", "JWT expired", schema mismatches.
4. **`app/auth/callback.tsx`** — the callback has a 12s screen-level timeout (`SCREEN_TIMEOUT_MS`). If users report "stuck forever", the Linking handoff isn't reaching the callback at all. Recent build with PKCE flow + router-params fallback should not have this. If it returned, suspect a regressed deep-link config (`scheme` in `app.json`, redirect allow-list in Supabase).
5. **Supabase Auth → URL Configuration** → confirm `stminaconnect://auth/callback` is still in the allow-list. Sometimes a teammate "cleans up" entries and removes it.

If broken: the fastest mitigation is to enable Supabase's default email sender (turn off Custom SMTP in the dashboard); deliverability is bad but at least login works while you fix the upstream.

## Sync outage — app shows stale data / queue grows

Symptom: users report "I added a person and it's not showing up", `useSyncState.queueLength` non-zero on multiple devices, or the in-app sync indicator is stuck on "offline".

**First five minutes:**

1. **`useSyncState.lastError`** — surfaced in the in-app sync indicator. Tap it; the message tells you the most recent failure.
2. **Supabase Logs → Postgres**: any RLS policy errors? Recently added policy that's too restrictive?
3. **Supabase Logs → API**: 5xx spikes? 429 rate limits?
4. **Recent migrations**: did the schema change in a way that breaks the existing client? Sync RPCs (`sync_persons_since`, `sync_events_since`, `sync_attendance_since`, `sync_notifications_since`) are the bridge — schema changes here without a corresponding client update break sync silently.
5. **`logs` table** (the app's error sink): `select * from public.logs order by created_at desc limit 50;` — recent client-side errors show up here.

Mitigation: revert the breaking migration via a forward `revert_*` migration (see `docs/runbook.md` § How to roll back a migration). Push out via the normal CI deploy.

## Push outage — notifications don't fire

Symptom: absence alerts trigger server-side (rows in `absence_alerts`) but no OS notification on devices.

**First five minutes:**

1. **`expo_push_tokens` table** — `select count(*) from public.expo_push_tokens where revoked_at is null;` — a single non-zero number expected per active device.
2. **`send-push-notification` Edge Function logs** (Supabase Dashboard → Edge Functions → Logs). 4xx responses from `https://exp.host/--/api/v2/push/send` mean the token is invalid; 429 means we're rate-limited.
3. **Expo Push Receipts**: Expo's push API is async — successful enqueue ≠ delivery. The function's job is enqueue; receipts are checked by Expo and not currently visible in our app. For a one-off sanity check, send a test push from <https://expo.dev/notifications> with a known token from `expo_push_tokens`.
4. **Quiet hours** — `quiet_hours` table (migration 038) blocks dispatch during the user's configured window. Verify the user isn't muted by config.
5. **Trigger** — `send-push-notification` is fired by an `AFTER INSERT` trigger on `notifications` (migration 039). If the trigger is disabled (`select * from pg_trigger where tgrelid = 'notifications'::regclass;`), pushes won't go out even though rows insert.

## Marketing site / legal pages outage

Symptom: `https://stminaconnect.com/` or `/privacy` returns 5xx or hangs.

**First five minutes:**

1. SSH to the Pi (`ssh mark@pi`) → `kubectl -n stminaconnect get pods` → expect 1/1 Ready. If 0/1, `kubectl -n stminaconnect describe pod <name>` and look at events.
2. `kubectl -n stminaconnect logs <pod-name>` → nginx errors? Most common: a missing file referenced by an `<img>` tag in the rendered legal HTML. Re-run `deno task render-legal`, commit, push.
3. **Cloudflare DNS**: `dig stminaconnect.com +short` → should resolve to the Pi's tailnet IP. If wrong, an A record was changed.
4. **Cluster cert**: nginx-ingress refreshes Let's Encrypt certs automatically. If a cert is stuck, `kubectl -n cert-manager get certificate -A` shows non-Ready certs. `kubectl describe` for the failure reason.

## Backup outage — weekly-backup not producing files

Symptom: B2 bucket has no new objects past the expected weekly cadence.

**First five minutes:**

1. **`cron.job_run_details`** in Supabase: `select jobname, status, start_time, return_message from cron.job_run_details where jobname = 'weekly-backup' order by start_time desc limit 5;` — recent run failures and their messages.
2. **Edge Function logs** for `weekly-backup` — recent error stack.
3. Most common cause: `BACKBLAZE_*` Edge Function secrets stale. Re-set them via `supabase secrets set` and trigger a manual run (POST to the function URL with the service-role bearer token).
4. If `cron.job_run_details` shows the job is unscheduled: re-run `select public.schedule_weekly_backup(...)` from `docs/production-setup.md` § 8.

## Communication

For any user-visible outage > 30 minutes:

1. Pin a message in the parish WhatsApp / email distribution: "St. Mina Connect is having an issue with [auth / sync / notifications]. We're investigating. ETA 1 hour."
2. After resolution: short post-mortem note in the same channel (what happened, what we did, what we'll change).
3. Open a GitHub issue tagged `incident:postmortem` with timeline + root cause + follow-ups, even for small incidents — the audit trail informs the next runbook revision.
