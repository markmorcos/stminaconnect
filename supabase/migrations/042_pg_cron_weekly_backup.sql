-- 042_pg_cron_weekly_backup.sql
-- Schedules the `weekly-backup` Edge Function to run every Sunday at
-- 02:00 Europe/Berlin via pg_cron + pg_net.
--
-- Requirements (one-time, per environment):
--   * pg_cron extension enabled — Dashboard → Database → Extensions
--   * pg_net extension enabled  — same path
--   * Vault secrets populated — Dashboard → Database → Vault:
--       weekly_backup_function_url       — full URL of the Edge Function
--       weekly_backup_service_role_key   — service role key for the
--                                          Authorization header
--
-- When either secret is absent, this migration creates the helper but
-- does not install the schedule — admins finish the wiring by
-- populating the Vault entries and calling
-- `select public.schedule_weekly_backup();` from the SQL editor.
--
-- Local development note: pg_cron's `schedule` only honours UTC times.
-- Europe/Berlin is UTC+1 (winter) / UTC+2 (summer). We schedule at
-- 01:00 UTC year-round, which means 02:00 Berlin in winter and 03:00
-- Berlin in summer — close enough for an off-hours weekly backup.
-- Adjust if exact wall-clock matters.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.schedule_weekly_backup(
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
  perform cron.unschedule('weekly-backup')
    where exists (select 1 from cron.job where jobname = 'weekly-backup');

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

  -- Sunday 01:00 UTC ≈ 02:00 Berlin in winter, 03:00 in summer.
  perform cron.schedule('weekly-backup', '0 1 * * 0', cmd);
end;
$$;

revoke execute on function public.schedule_weekly_backup(text, text) from public;
grant execute on function public.schedule_weekly_backup(text, text) to service_role;

-- Best-effort initial install from Vault. Skips with NOTICE if either
-- secret is missing — same pattern as 013_pg_cron_sync_calendar.sql.
do $$
declare
  function_url text;
  auth_token   text;
  has_vault    boolean;
begin
  select exists (
    select 1 from pg_extension where extname = 'supabase_vault'
  ) into has_vault;
  if not has_vault then
    raise notice 'pg_cron weekly-backup: supabase_vault extension not present — skipping initial install';
    return;
  end if;

  select decrypted_secret into function_url
    from vault.decrypted_secrets
    where name = 'weekly_backup_function_url';
  select decrypted_secret into auth_token
    from vault.decrypted_secrets
    where name = 'weekly_backup_service_role_key';

  if function_url is null or auth_token is null then
    raise notice 'pg_cron weekly-backup: Vault secrets not populated — call public.schedule_weekly_backup(url, key) manually after setting them.';
    return;
  end if;

  perform public.schedule_weekly_backup(function_url, auth_token);
  raise notice 'pg_cron weekly-backup: scheduled via Vault secrets';
end
$$;
