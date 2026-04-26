-- 013_pg_cron_sync_calendar.sql
-- Schedules the `sync-calendar-events` Edge Function to run every 30
-- minutes via pg_cron + pg_net.
--
-- Requirements (one-time, per environment):
--   * pg_cron extension enabled — Dashboard → Database → Extensions
--   * pg_net extension enabled  — same path
--   * Vault secrets populated — Dashboard → Database → Vault, or CLI:
--       supabase secrets set EDGE_FUNCTION_URL=...
--       (the migration reads from `vault.decrypted_secrets` directly)
--
-- The Vault entries used:
--   `sync_calendar_function_url`        — full URL of the Edge Function
--                                         (e.g. https://<project>.supabase.co
--                                         /functions/v1/sync-calendar-events).
--   `sync_calendar_service_role_key`    — service role key sent in the
--                                         Authorization header so the
--                                         Edge Function can authenticate.
--
-- When either secret is absent, this migration creates the schedule
-- with a no-op statement and logs a NOTICE — admins finish the wiring
-- by populating the secrets and calling
-- `select public.schedule_calendar_sync();`.
--
-- Local development note: Supabase CLI ships pg_cron and pg_net
-- pre-enabled. For local testing call:
--   select public.schedule_calendar_sync(
--     'http://host.docker.internal:54321/functions/v1/sync-calendar-events',
--     '<local-anon-key>'
--   );

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Helper that (re)installs the cron job pointing at the given URL and
-- using the given auth token. Admins call this once after deploy and
-- whenever the function URL or service role key rotates.
create or replace function public.schedule_calendar_sync(
  function_url text,
  auth_token   text
)
returns void
language plpgsql
security definer
set search_path = public, cron, net
as $$
declare
  cmd text;
begin
  -- Drop any existing schedule with this name so re-running is safe.
  perform cron.unschedule('sync-calendar-events')
    where exists (select 1 from cron.job where jobname = 'sync-calendar-events');

  cmd := format(
    $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || %L
        ),
        body := '{}'::jsonb
      );
    $cmd$,
    function_url,
    auth_token
  );

  perform cron.schedule('sync-calendar-events', '*/30 * * * *', cmd);
end;
$$;

revoke execute on function public.schedule_calendar_sync(text, text) from public;
grant execute on function public.schedule_calendar_sync(text, text) to service_role;

-- Best-effort initial install from Vault. Skips silently if either
-- secret is missing or the Vault extension isn't present (e.g. local
-- dev without Vault).
do $$
declare
  fn_url text;
  fn_key text;
  has_vault boolean;
begin
  select exists (
    select 1 from pg_extension where extname = 'supabase_vault'
  ) into has_vault;

  if not has_vault then
    raise notice 'supabase_vault extension not present; skipping initial cron install. Call schedule_calendar_sync(url, key) manually.';
    return;
  end if;

  begin
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1'
      into fn_url
      using 'sync_calendar_function_url';
  exception when others then
    fn_url := null;
  end;

  begin
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1'
      into fn_key
      using 'sync_calendar_service_role_key';
  exception when others then
    fn_key := null;
  end;

  if fn_url is null or fn_key is null then
    raise notice 'Vault secrets sync_calendar_function_url / sync_calendar_service_role_key not populated; skipping initial cron install. Call schedule_calendar_sync(url, key) once they are set.';
    return;
  end if;

  perform public.schedule_calendar_sync(fn_url, fn_key);
end;
$$;
