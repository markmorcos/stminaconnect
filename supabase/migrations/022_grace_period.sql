-- 022_grace_period.sql
-- Adds a grace-period buffer to absence detection so events that
-- happened within the last N days are invisible to the streak walk —
-- giving servants time to backfill attendance after a service before
-- the algorithm treats those events as misses.
--
-- Default: 3 days. Admin-tunable through the alerts settings screen.
--
-- Interaction with prior knobs:
--   - cold-start filter (021): event.start_at >= persons.registered_at
--   - grace-period filter (this migration): event.start_at <= now() - grace_period_days
--   - break filter: events whose start_at < paused_until are skipped
--
-- All three combine: only events in
--   [persons.registered_at, now() - grace_period_days]
-- minus break-window events count toward the streak.

alter table public.alert_config
  add column if not exists grace_period_days int not null default 3
    check (grace_period_days >= 0);

-- ---------------------------------------------------------------------------
-- compute_streak — replaces 021. Adds the grace-period filter.
-- ---------------------------------------------------------------------------

create or replace function public.compute_streak(
  p_person_id uuid,
  p_at        timestamptz default now()
)
returns int
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  paused_until_d  date;
  registered_at_t timestamptz;
  grace_days      int;
  cutoff          timestamptz;
  streak int := 0;
  ev record;
  attended boolean;
begin
  select paused_until, registered_at
    into paused_until_d, registered_at_t
    from public.persons
   where id = p_person_id;

  if registered_at_t is null then
    registered_at_t := '1970-01-01'::timestamptz;
  end if;

  select grace_period_days into grace_days
    from public.alert_config
    order by updated_at desc
    limit 1;
  grace_days := coalesce(grace_days, 3);

  -- Events whose start_at is AFTER `cutoff` are too recent to count
  -- toward the streak — servants still have a window to backfill
  -- attendance for them.
  cutoff := p_at - make_interval(days => grace_days);

  for ev in
    select id, start_at
      from public.events
     where is_counted = true
       and start_at < p_at
       and start_at <= cutoff
       and start_at >= registered_at_t
     order by start_at desc
  loop
    if paused_until_d is not null
       and paused_until_d::timestamptz > ev.start_at
    then
      continue;
    end if;

    select exists (
      select 1
        from public.attendance a
       where a.event_id  = ev.id
         and a.person_id = p_person_id
         and a.is_present = true
    ) into attended;

    if attended then
      return streak;
    end if;

    streak := streak + 1;
  end loop;

  return streak;
end;
$$;

revoke execute on function public.compute_streak(uuid, timestamptz) from public;
grant execute on function public.compute_streak(uuid, timestamptz) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- update_alert_config — replaces 018. Adds the new param.
-- ---------------------------------------------------------------------------

create or replace function public.update_alert_config(
  p_absence_threshold     int     default null,
  p_priority_thresholds   jsonb   default null,
  p_notify_admin_on_alert boolean default null,
  p_escalation_threshold  int     default null,
  p_clear_escalation      boolean default false,
  p_grace_period_days     int     default null
)
returns public.alert_config
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.alert_config;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  update public.alert_config
     set absence_threshold     = coalesce(p_absence_threshold, absence_threshold),
         priority_thresholds   = coalesce(p_priority_thresholds, priority_thresholds),
         notify_admin_on_alert = coalesce(p_notify_admin_on_alert, notify_admin_on_alert),
         escalation_threshold  = case
                                   when p_clear_escalation then null
                                   else coalesce(p_escalation_threshold, escalation_threshold)
                                 end,
         grace_period_days     = coalesce(p_grace_period_days, grace_period_days),
         updated_at            = now(),
         updated_by            = auth.uid()
   where id = (select id from public.alert_config limit 1)
   returning * into result;

  return result;
end;
$$;

-- The old 5-arg overload is kept implicitly by Postgres because we
-- changed the function's argument list — drop it explicitly so callers
-- can't mistakenly hit a stale signature.
do $$
begin
  -- Best-effort drop of the prior 5-arg signature. Errors silently if
  -- already removed (e.g. running this migration twice).
  begin
    drop function if exists public.update_alert_config(int, jsonb, boolean, int, boolean);
  exception when others then
    null;
  end;
end$$;

revoke execute on function public.update_alert_config(int, jsonb, boolean, int, boolean, int) from public;
grant execute on function public.update_alert_config(int, jsonb, boolean, int, boolean, int) to authenticated;
