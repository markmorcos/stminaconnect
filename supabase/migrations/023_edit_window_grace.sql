-- 023_edit_window_grace.sql
-- Extends the attendance edit window by `alert_config.grace_period_days`.
--
-- The original cutoff (015_attendance.sql) was 03:00 Europe/Berlin on
-- the day after the event. With this change, the cutoff slides forward
-- by `grace_period_days` so servants can still backfill attendance for
-- recent events that the streak walk is also ignoring.
--
-- This means a single knob — `grace_period_days` — controls both:
--   1. Which recent events the streak walk skips (compute_streak in 022).
--   2. How long mark_attendance / unmark_attendance accept writes for.
--
-- That coupling is intentional: if servants can't backfill, we shouldn't
-- be alerting on a missed event yet; if they CAN backfill, the streak
-- shouldn't have already counted it as a miss.

create or replace function public.is_event_within_edit_window(p_event_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  event_start timestamptz;
  grace_days  int;
  cutoff      timestamptz;
begin
  select start_at into event_start
    from public.events
   where id = p_event_id;

  if event_start is null then
    return false;
  end if;

  select grace_period_days into grace_days
    from public.alert_config
    order by updated_at desc
    limit 1;
  grace_days := coalesce(grace_days, 0);

  -- Berlin local date of the event start, plus one day and the grace
  -- window, at 03:00 Berlin — then converted back to UTC.
  cutoff := (
    (
      date_trunc('day', timezone('Europe/Berlin', event_start))
      + interval '1 day 3 hours'
      + make_interval(days => grace_days)
    )
    at time zone 'Europe/Berlin'
  );

  return now() < cutoff;
end;
$$;

revoke execute on function public.is_event_within_edit_window(uuid) from public;
grant execute on function public.is_event_within_edit_window(uuid) to authenticated;
