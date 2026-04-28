-- 032_calendar_sync_on_app_load.sql
-- A non-admin variant of `trigger_calendar_sync()` so the mobile
-- client can keep the events mirror fresh whenever a servant opens
-- the app, without granting every signed-in user the admin-only
-- right to fire the existing button.
--
-- Differences from `trigger_calendar_sync()`:
--   * gated only on `is_authenticated` (any signed-in servant).
--   * rate-limited to once every 10 minutes instead of once per
--     minute — every app cold-start would otherwise hammer the
--     upstream Google Calendar API.
--   * returns `{ outcome: 'skipped_recent' }` when the rate limit
--     would have rejected the call, so the client can treat that
--     as a successful no-op rather than an error.
--
-- Cascade delete: removing an event already removes its attendance
-- rows via the FK `attendance.event_id REFERENCES events(id) ON
-- DELETE CASCADE` introduced in 015_attendance.sql. The sync edge
-- function deletes events that fell out of the upstream calendar OR
-- out of the rolling window, so dropped events also lose their
-- attendance records automatically — no work needed here.

create or replace function public.trigger_calendar_sync_if_stale()
returns jsonb
language plpgsql
security definer
set search_path = public, net
as $$
declare
  recent_count int;
  fn_url       text;
  fn_key       text;
  request_id   bigint;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  -- 10-minute window. Anything inside that → quiet skip.
  select count(*) into recent_count
    from public.sync_log
   where source = 'calendar'
     and started_at > now() - interval '10 minutes';

  if recent_count > 0 then
    return jsonb_build_object('outcome', 'skipped_recent');
  end if;

  -- Resolve Edge Function URL + service role key from Vault. Same
  -- error contract as `trigger_calendar_sync()` so the client can
  -- handle "not configured" identically.
  begin
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1'
      into fn_url
      using 'sync_calendar_function_url';
  exception when others then
    raise exception 'sync_calendar_function_url Vault secret not configured';
  end;

  begin
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1'
      into fn_key
      using 'sync_calendar_service_role_key';
  exception when others then
    raise exception 'sync_calendar_service_role_key Vault secret not configured';
  end;

  if fn_url is null or fn_key is null then
    raise exception 'calendar sync Vault secrets missing';
  end if;

  select net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || fn_key
    ),
    body := '{}'::jsonb
  ) into request_id;

  return jsonb_build_object('outcome', 'queued', 'request_id', request_id);
end;
$$;

revoke execute on function public.trigger_calendar_sync_if_stale() from public;
grant  execute on function public.trigger_calendar_sync_if_stale() to authenticated;
