-- 038_quiet_hours.sql
-- Per-servant push preferences: notification language + quiet hours.
--
-- The `send-push-notification` Edge Function reads these to decide
-- (a) which language to render the title/body in, and (b) whether the
-- current Berlin-local time falls inside the recipient's quiet-hours
-- window. The in-app inbox row is always created — quiet hours suppress
-- the OS push only.
--
-- Times stored without timezone — interpreted as Europe/Berlin local
-- per design.md decision 7 (the parish is single-timezone today; if
-- this ever needs to change we'll add a `timezone` column rather than
-- migrating data).

alter table public.servants
  add column if not exists language             text not null default 'en'
                                                check (language in ('en', 'ar', 'de')),
  add column if not exists quiet_hours_enabled  boolean not null default false,
  add column if not exists quiet_hours_start    time,
  add column if not exists quiet_hours_end      time;

-- update_my_notification_settings — single RPC for the settings screen
-- to write all four fields atomically. NULL on either time is allowed
-- when the toggle is disabled; when the toggle is enabled, both times
-- must be present (validated client-side; we still defend here so a
-- buggy client can't end up with a half-configured window).
create or replace function public.update_my_notification_settings(
  language             text,
  quiet_hours_enabled  boolean,
  quiet_hours_start    time,
  quiet_hours_end      time
)
returns public.servants
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  result public.servants;
begin
  if caller is null then
    raise exception 'unauthenticated';
  end if;

  if language is not null and language not in ('en', 'ar', 'de') then
    raise exception 'invalid language: %', language;
  end if;

  if quiet_hours_enabled and (quiet_hours_start is null or quiet_hours_end is null) then
    raise exception 'quiet hours enabled but start/end times missing';
  end if;

  update public.servants
     set language            = coalesce(update_my_notification_settings.language, public.servants.language),
         quiet_hours_enabled = update_my_notification_settings.quiet_hours_enabled,
         quiet_hours_start   = update_my_notification_settings.quiet_hours_start,
         quiet_hours_end     = update_my_notification_settings.quiet_hours_end,
         updated_at          = now()
   where id = caller
  returning * into result;

  if not found then
    raise exception 'servant row missing for %', caller;
  end if;

  return result;
end;
$$;

revoke execute on function public.update_my_notification_settings(text, boolean, time, time) from public;
grant execute on function public.update_my_notification_settings(text, boolean, time, time) to authenticated;
