-- supabase/seed_vault.sql
-- Idempotent local-dev seed for the two Vault secrets that
-- `trigger_calendar_sync()` (014_calendar_rpcs.sql) and the
-- `pg_cron` schedule (013_pg_cron_sync_calendar.sql) read.
--
-- Run via `make seed-vault`, which pulls SERVICE_ROLE_KEY from
-- `supabase status -o json` and passes it as a psql variable so we
-- never commit the dev JWT to git.
--
-- Without these two entries:
--   * the in-app "Resync now" button surfaces "Could not start resync"
--   * `select public.trigger_calendar_sync()` errors with
--     `sync_calendar_function_url Vault secret not configured`
--
-- This file is for LOCAL DEVELOPMENT ONLY. Production secrets are
-- created once via the Dashboard SQL Editor (see
-- `docs/google-calendar-setup.md` § 7).

\if :{?service_role_key}
\else
  \echo '!! seed_vault.sql requires -v service_role_key=...'
  \echo '!! Run via `make seed-vault` instead of psql directly.'
  \quit 1
\endif

begin;

-- Wipe any previous entries first so re-running the script is safe
-- (vault.secrets has a unique constraint on `name`).
delete from vault.secrets
 where name in ('sync_calendar_function_url', 'sync_calendar_service_role_key');

-- Function URL: from inside the Postgres container, the host's
-- 127.0.0.1 is `host.docker.internal`. Kong serves the Edge Functions
-- on the same 54321 port the host sees.
select vault.create_secret(
  'http://host.docker.internal:54321/functions/v1/sync-calendar-events',
  'sync_calendar_function_url'
);

-- Service-role key, supplied at invocation time by the Makefile target
-- (`supabase status -o json | jq -r .SERVICE_ROLE_KEY`). The key varies
-- per project, so it cannot be hardcoded here without committing it.
select vault.create_secret(
  :'service_role_key',
  'sync_calendar_service_role_key'
);

commit;
