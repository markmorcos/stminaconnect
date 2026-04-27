-- 027_dashboard_rpcs.sql
-- Aggregation RPCs for the admin dashboard.
--
-- All five functions are SECURITY DEFINER and gated on is_admin(). Each
-- maps 1:1 to a dashboard section so the client can fetch them in
-- parallel (TanStack Query); a slow section never blocks the others.
--
-- Berlin (Europe/Berlin) is the canonical timezone for "today" /
-- "this month" math: the church operates in Munich and admins reason
-- in local dates, not UTC.

-- ---------------------------------------------------------------------------
-- dashboard_overview() -> jsonb
--   { totalMembers, activeLast30, newThisMonth, avgAttendance4w }
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_overview()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  total_members      int;
  active_last_30     int;
  new_this_month     int;
  attendance_rows    int;
  counted_event_rows int;
  avg_attendance     numeric;
  month_start_berlin timestamptz;
  thirty_days_ago    timestamptz;
  four_weeks_ago     timestamptz;
begin
  if not public.is_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  thirty_days_ago    := now() - interval '30 days';
  four_weeks_ago     := now() - interval '4 weeks';
  month_start_berlin := (
    date_trunc('month', timezone('Europe/Berlin', now())) at time zone 'Europe/Berlin'
  );

  select count(*) into total_members
    from public.persons
   where deleted_at is null;

  select count(distinct a.person_id) into active_last_30
    from public.attendance a
    join public.events e on e.id = a.event_id
   where e.is_counted = true
     and e.start_at >= thirty_days_ago;

  select count(*) into new_this_month
    from public.persons
   where deleted_at is null
     and registered_at >= month_start_berlin;

  select count(*) into attendance_rows
    from public.attendance a
    join public.events e on e.id = a.event_id
   where e.is_counted = true
     and e.start_at >= four_weeks_ago;

  select count(*) into counted_event_rows
    from public.events
   where is_counted = true
     and start_at >= four_weeks_ago
     and start_at < now();

  if counted_event_rows = 0 then
    avg_attendance := 0;
  else
    avg_attendance := round(attendance_rows::numeric / counted_event_rows, 1);
  end if;

  return jsonb_build_object(
    'totalMembers',     total_members,
    'activeLast30',     active_last_30,
    'newThisMonth',     new_this_month,
    'avgAttendance4w',  avg_attendance
  );
end;
$$;

revoke execute on function public.dashboard_overview() from public;
grant  execute on function public.dashboard_overview() to authenticated;

-- ---------------------------------------------------------------------------
-- dashboard_attendance_trend(weeks int default 12)
--   -> table(event_id uuid, event_title text, start_at timestamptz, attendee_count int)
--
-- One row per counted event in the last `weeks` weeks, oldest first so
-- the line chart's x-axis flows left-to-right.
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_attendance_trend(p_weeks int default 12)
returns table (
  event_id        uuid,
  event_title     text,
  start_at        timestamptz,
  attendee_count  int
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  cutoff timestamptz;
begin
  if not public.is_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if p_weeks is null or p_weeks < 1 then
    p_weeks := 12;
  end if;
  cutoff := now() - (p_weeks || ' weeks')::interval;

  return query
    select e.id,
           e.title,
           e.start_at,
           coalesce(count(a.id)::int, 0) as attendee_count
      from public.events e
      left join public.attendance a on a.event_id = e.id
     where e.is_counted = true
       and e.start_at >= cutoff
       and e.start_at <= now()
     group by e.id, e.title, e.start_at
     order by e.start_at asc;
end;
$$;

revoke execute on function public.dashboard_attendance_trend(int) from public;
grant  execute on function public.dashboard_attendance_trend(int) to authenticated;

-- ---------------------------------------------------------------------------
-- dashboard_at_risk()
--   -> table(servant_id, servant_name, person_id, person_name, streak,
--            last_event_id, last_event_title, last_event_at)
--
-- Flat rowset of all persons with at least one unresolved absence_alert.
-- Client groups by servant_id for the section UI. Streak comes from the
-- existing compute_streak() helper. Capped at 50 so a worst-case dataset
-- doesn't drag the dashboard down.
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_at_risk()
returns table (
  servant_id        uuid,
  servant_name      text,
  person_id         uuid,
  person_name       text,
  streak            int,
  last_event_id     uuid,
  last_event_title  text,
  last_event_at     timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  return query
    with open_alerts as (
      select aa.person_id,
             aa.last_event_id,
             aa.crossed_at,
             row_number() over (
               partition by aa.person_id
               order by aa.crossed_at desc
             ) as rn
        from public.absence_alerts aa
       where aa.resolved_at is null
    )
    select s.id            as servant_id,
           coalesce(nullif(trim(s.display_name), ''), s.email) as servant_name,
           p.id            as person_id,
           (p.first_name || ' ' || p.last_name) as person_name,
           public.compute_streak(p.id, now())   as streak,
           e.id            as last_event_id,
           e.title         as last_event_title,
           e.start_at      as last_event_at
      from open_alerts oa
      join public.persons  p on p.id = oa.person_id and p.deleted_at is null
      join public.servants s on s.id = p.assigned_servant
      left join public.events e on e.id = oa.last_event_id
     where oa.rn = 1
     order by servant_name asc, streak desc, person_name asc
     limit 50;
end;
$$;

revoke execute on function public.dashboard_at_risk() from public;
grant  execute on function public.dashboard_at_risk() to authenticated;

-- ---------------------------------------------------------------------------
-- dashboard_newcomer_funnel(days int default 90) -> jsonb
--   { quickAdd, upgraded, active }
--
--   quickAdd  — persons registered as quick_add in the last `days`.
--   upgraded  — of those, persons whose registration_type is now 'full'
--               (the upgrade flow flips registration_type).
--   active    — of those, persons with at least one attendance row at a
--               counted event in the last 30 days.
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_newcomer_funnel(p_days int default 90)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  window_start    timestamptz;
  thirty_days_ago timestamptz;
  qa_count        int;
  up_count        int;
  active_count    int;
begin
  if not public.is_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if p_days is null or p_days < 1 then
    p_days := 90;
  end if;
  window_start    := now() - (p_days || ' days')::interval;
  thirty_days_ago := now() - interval '30 days';

  -- Top of funnel: all newcomers in the window. Without an audit column
  -- we can't recover the *original* registration_type after upgrade, so
  -- "Quick Add" stands in for "anyone who entered the funnel" — which
  -- in practice is every newcomer (full-direct registrations are rare).
  select count(*) into qa_count
    from public.persons p
   where p.deleted_at is null
     and p.registered_at >= window_start;

  -- Middle: of those, currently 'full' (upgrade flow flips the column).
  select count(*) into up_count
    from public.persons p
   where p.deleted_at is null
     and p.registered_at >= window_start
     and p.registration_type = 'full';

  -- Bottom: of those upgraded, attending a counted event in last 30d.
  select count(distinct p.id) into active_count
    from public.persons p
    join public.attendance a on a.person_id = p.id
    join public.events    e on e.id = a.event_id
   where p.deleted_at is null
     and p.registered_at >= window_start
     and p.registration_type = 'full'
     and e.is_counted = true
     and e.start_at >= thirty_days_ago;

  return jsonb_build_object(
    'quickAdd', qa_count,
    'upgraded', up_count,
    'active',   active_count
  );
end;
$$;

revoke execute on function public.dashboard_newcomer_funnel(int) from public;
grant  execute on function public.dashboard_newcomer_funnel(int) to authenticated;

-- ---------------------------------------------------------------------------
-- dashboard_region_breakdown(top int default 8)
--   -> table(region text, member_count int)
--
-- Top N regions by member count, plus an "Other" bucket rolling up the
-- tail. Persons without a region (NULL or empty trim) are excluded.
-- "Other" is returned only when there is a tail to report.
--
-- The output column is `member_count`, not `count`, because `count` as
-- a column name in RETURNS TABLE collides with the count() aggregate
-- when referenced inside the body (e.g. ORDER BY count).
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_region_breakdown(p_top int default 8)
returns table (
  region        text,
  member_count  int
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if p_top is null or p_top < 1 then
    p_top := 8;
  end if;

  return query
    with regions_grouped as (
      select trim(p.region) as r, count(*)::int as cnt
        from public.persons p
       where p.deleted_at is null
         and p.region is not null
         and trim(p.region) <> ''
       group by trim(p.region)
    ),
    ranked as (
      select r,
             cnt,
             row_number() over (order by cnt desc, r asc) as rn
        from regions_grouped
    ),
    top_n as (
      select r, cnt from ranked where rn <= p_top
    ),
    other as (
      select 'Other'::text as r, coalesce(sum(cnt), 0)::int as cnt
        from ranked
       where rn > p_top
    ),
    combined as (
      select r, cnt from top_n
      union all
      select r, cnt from other where cnt > 0
    )
    select c.r, c.cnt
      from combined c
     order by c.cnt desc, c.r asc;
end;
$$;

revoke execute on function public.dashboard_region_breakdown(int) from public;
grant  execute on function public.dashboard_region_breakdown(int) to authenticated;
