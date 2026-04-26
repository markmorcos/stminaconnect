# Google Calendar setup — `sync-calendar-events`

This guide walks an admin through the one-time Google Cloud configuration that
the `sync-calendar-events` Edge Function needs. Total time: ~15 minutes.

The result is two values that get stored as Supabase Edge Function secrets:

- `GOOGLE_CALENDAR_ID` — the calendar to read.
- `GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON` — the single-line JSON key for the
  service account that reads it.

## Why a service account

The church calendar is owned by clergy in their personal Google account. We
authenticate as a non-human "service account" instead of asking clergy to log
in through OAuth — the service account is granted **read-only** access to the
calendar, nothing else.

## 1. Create a Google Cloud project

1. Sign in to <https://console.cloud.google.com>.
2. Top bar → project dropdown → **New Project**.
3. Name: `St Mina Connect Calendar Sync`. Organization: leave default.
4. Click **Create**, then select the new project from the dropdown.

## 2. Enable the Calendar API

1. Left nav → **APIs & Services** → **Library**.
2. Search **Google Calendar API** → **Enable**.

## 3. Create the service account

1. Left nav → **IAM & Admin** → **Service Accounts** → **+ Create service
   account**.
2. Name: `calendar-sync`. ID auto-fills.
3. Skip the optional "grant access to project" step (we don't need any GCP
   roles — the only permission we need is on the Calendar itself).
4. Click **Done**.
5. Open the new service account → **Keys** tab → **Add key** → **Create new
   key** → **JSON** → **Create**. A `*.json` file downloads.

> Treat this file like a password. It grants read access to the calendar.
> Store it in a password manager and delete the local copy when done.

## 4. Share the church calendar with the service account

1. Open the JSON file from step 3 → copy the `client_email` value
   (looks like `calendar-sync@st-mina-connect-….iam.gserviceaccount.com`).
2. Open Google Calendar at <https://calendar.google.com>.
3. Hover the church calendar in the left list → **⋮** → **Settings and
   sharing**.
4. Under **Share with specific people or groups** → **Add people and groups**.
5. Paste the `client_email`. Permission: **See all event details**. Click
   **Send**.

The service account now has read-only access to that calendar.

## 5. Capture the calendar ID

In the same **Settings and sharing** page, scroll to **Integrate calendar**
and copy the **Calendar ID**. For private calendars this looks like a long
hash ending in `@group.calendar.google.com`. For the primary calendar of an
account, it's the email address itself.

## 6. Configure the Edge Function secrets

These are read by the Edge Function at runtime via `Deno.env.get(...)` —
they live with the function, not in Postgres.

### Local development (`supabase functions serve`)

Create `supabase/functions/.env` (gitignored). With the exact filename
`.env` placed at this exact path, the Supabase CLI auto-loads it on
`supabase start` — no `--env-file` flag needed.

```bash
GOOGLE_CALENDAR_ID=<your calendar id>
GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON=<paste entire JSON on one line>
```

Tip: collapse the JSON to one line with `jq -c . key.json`.

Then:

```bash
npx supabase stop && npx supabase start          # auto-load only kicks in on start
npx supabase functions serve sync-calendar-events
```

(If you prefer a non-default filename like `.env.local`, you have to
pass `--env-file supabase/functions/.env.local` to `serve` and skip
`supabase stop && start`.)

### Hosted Supabase project (production)

```bash
npx supabase secrets set GOOGLE_CALENDAR_ID=<your calendar id>
npx supabase secrets set GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON="$(jq -c . path/to/key.json)"
npx supabase functions deploy sync-calendar-events
```

## 7. Configure Vault secrets (for the in-app Resync button + cron)

The Edge Function secrets above let the function talk to **Google**.
But the app's "Resync now" button (and the every-30-minute pg_cron
schedule) calls the function from **inside Postgres**, via the
`trigger_calendar_sync()` RPC + `pg_net`. Postgres can't read the
function's `.env` file — different runtime, different container — so
the function URL and the auth token it should send must live in
Postgres Vault.

Without these two secrets, `select public.trigger_calendar_sync();`
errors with `sync_calendar_function_url Vault secret not configured`,
and the Resync button surfaces "Could not start resync". The Edge
Function and direct `curl` invocations are unaffected.

### Local development

In Supabase Studio (`http://127.0.0.1:54323`) → SQL Editor:

```sql
-- 1. Function URL. From inside the Postgres container, the host's
-- 127.0.0.1 is `host.docker.internal`. The function runs on Kong's
-- public port 54321.
select vault.create_secret(
  'http://host.docker.internal:54321/functions/v1/sync-calendar-events',
  'sync_calendar_function_url'
);

-- 2. Service role key. Get it from your terminal first:
--      npx supabase status -o json | jq -r .SERVICE_ROLE_KEY
-- and paste it below (keep the single quotes).
select vault.create_secret(
  '<paste-local-service-role-key>',
  'sync_calendar_service_role_key'
);
```

Verify:

```sql
select name from vault.secrets;
-- expect: sync_calendar_function_url, sync_calendar_service_role_key

select public.trigger_calendar_sync();
-- expect: {"request_id": <number>, "outcome": "queued"}
```

### Hosted Supabase project (production)

Same two `vault.create_secret(...)` calls, but with the production URL
and the prod service role key. Run them in the Supabase Dashboard SQL
Editor for the prod project:

```sql
select vault.create_secret(
  'https://<your-project-ref>.supabase.co/functions/v1/sync-calendar-events',
  'sync_calendar_function_url'
);

select vault.create_secret(
  '<prod service role key from Dashboard → Project Settings → API>',
  'sync_calendar_service_role_key'
);
```

Once both Vault entries exist, the cron schedule installs itself on
the next migration run (the DO block in `013_pg_cron_sync_calendar.sql`
reads from Vault). To install immediately without a migration:

```sql
select public.schedule_calendar_sync(
  'https://<project-ref>.supabase.co/functions/v1/sync-calendar-events',
  '<prod service role key>'
);
```

### Updating a Vault secret

```sql
select vault.update_secret(
  (select id from vault.secrets where name = 'sync_calendar_service_role_key'),
  '<new value>'
);
```

If you rotate the service role key (rare), rotate this Vault entry at
the same time.

## 8. Validate the setup

Trigger a manual sync and inspect the result:

```bash
# Local — anonymous invocation is allowed for local dev
curl -i -X POST http://127.0.0.1:54321/functions/v1/sync-calendar-events \
  -H "Authorization: Bearer $(npx supabase status --output json | jq -r .anon_key)"
```

Expected: HTTP 200 with `{ "outcome": "success", "upserted": <n> }`.

Then in psql:

```sql
select id, title, start_at, is_counted from public.events order by start_at;
select * from public.sync_log order by started_at desc limit 5;
```

If the events you put in the calendar appear here with the correct timestamps,
the integration works.

## 9. Enable required Postgres extensions (hosted projects only)

Local Supabase has `pg_cron` and `pg_net` enabled by default. On a hosted
Supabase project, enable them once via the Dashboard:

**Database → Extensions** → search **pg_cron** → **Enable**. Repeat for
**pg_net**.

The `013_pg_cron_sync_calendar.sql` migration assumes both are present.

## 10. Rotation

If the JSON key is ever exposed:

1. In Google Cloud → service account → **Keys** → delete the old key.
2. Create a new key (step 3.5 above).
3. Update the Supabase secret with the new JSON.

The Edge Function picks up the new key on its next invocation; no restart
required.
