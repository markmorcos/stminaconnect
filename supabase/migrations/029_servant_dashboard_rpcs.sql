-- 029_servant_dashboard_rpcs.sql
-- Aggregation RPCs for the non-admin servant home screen (My Group,
-- pending follow-ups count, recent newcomers).
--
-- Each function maps 1:1 to a section so the home screen can fetch the
-- three queries in parallel through TanStack Query; one slow/erroring
-- section never blocks the others.
--
-- Ownership model:
--   - servant_my_group defaults to the caller (auth.uid()). Passing a
--     different servant_id requires admin (mirrors the existing pattern
--     in list_follow_ups_pending — admins can inspect any servant's view).
--   - servant_pending_followups_count and servant_recent_newcomers are
--     scoped: the count is per-caller; recent newcomers spans all
--     servants (per design.md decision 5 — "church-wide view").
--
-- Note: the per-row threshold returned by servant_my_group is computed
-- here (priority_thresholds → absence_threshold fallback) so the client
-- doesn't need a second round-trip to alert_config to colour rows. The
-- bucket itself ('green' | 'yellow' | 'red' | 'break') is derived on
-- the client by streakStatus.ts so the rule has a single, unit-tested
-- source of truth.

-- ---------------------------------------------------------------------------
-- servant_my_group(servant_id uuid default auth.uid())
--   -> table(person_id, first_name, last_name, region, last_attendance_at,
--            streak, threshold, status, paused_until, priority)
--
-- One row per assigned, non-deleted person. last_attendance_at is the
-- start_at of the most recent counted event the person was marked
-- present at (NULL if never). streak comes from compute_streak.
-- threshold reflects the priority-specific override or the global
-- default — matches the rule used in detect_absences.
-- ---------------------------------------------------------------------------
create or replace function public.servant_my_group(p_servant_id uuid default null)
returns table (
  person_id          uuid,
  first_name         text,
  last_name          text,
  region             text,
  last_attendance_at timestamptz,
  streak             int,
  threshold          int,
  status             text,
  paused_until       date,
  priority           text
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  caller     uuid := auth.uid();
  servant_id uuid := coalesce(p_servant_id, caller);
  cfg        public.alert_config;
begin
  if caller is null then
    raise exception 'unauthenticated';
  end if;
  if servant_id <> caller and not public.is_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select * into cfg from public.alert_config order by updated_at desc limit 1;

  return query
    select p.id                                     as person_id,
           p.first_name                             as first_name,
           p.last_name                              as last_name,
           p.region                                 as region,
           (
             select max(e.start_at)
               from public.attendance a
               join public.events     e on e.id = a.event_id
              where a.person_id  = p.id
                and a.is_present = true
                and e.is_counted = true
           )                                         as last_attendance_at,
           public.compute_streak(p.id, now())        as streak,
           coalesce(
             nullif(cfg.priority_thresholds ->> p.priority, '')::int,
             cfg.absence_threshold
           )                                         as threshold,
           p.status                                  as status,
           p.paused_until                            as paused_until,
           p.priority                                as priority
      from public.persons p
     where p.deleted_at        is null
       and p.assigned_servant  = servant_id;
end;
$$;

revoke execute on function public.servant_my_group(uuid) from public;
grant  execute on function public.servant_my_group(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- servant_pending_followups_count() -> int
--
-- Count of unresolved absence_alerts for the caller's assigned persons
-- that do NOT yet have a follow_up logged after the alert crossed.
-- Logic mirrors the `needs_follow_up` section of list_follow_ups_pending
-- so the badge always agrees with the dedicated screen's first section.
-- Admins see all unresolved alerts (the dedicated screen does the same).
-- ---------------------------------------------------------------------------
create or replace function public.servant_pending_followups_count()
returns int
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  caller   uuid := auth.uid();
  is_admin boolean;
  result   int;
begin
  if caller is null then
    raise exception 'unauthenticated';
  end if;

  is_admin := public.is_admin();

  select count(*)::int into result
    from public.absence_alerts a
    join public.persons        p on p.id = a.person_id
   where a.resolved_at is null
     and p.deleted_at  is null
     and (is_admin or p.assigned_servant = caller)
     and not exists (
       select 1
         from public.follow_ups f
        where f.person_id  = a.person_id
          and f.created_at >= a.crossed_at
     );

  return coalesce(result, 0);
end;
$$;

revoke execute on function public.servant_pending_followups_count() from public;
grant  execute on function public.servant_pending_followups_count() to authenticated;

-- ---------------------------------------------------------------------------
-- servant_recent_newcomers(days int default 30)
--   -> table(person_id, first_name, last_name, registered_at,
--            registration_type, region)
--
-- All non-deleted persons whose registered_at falls inside the window,
-- regardless of assigned_servant. Spans the whole church (design.md
-- decision 5).
-- ---------------------------------------------------------------------------
create or replace function public.servant_recent_newcomers(p_days int default 30)
returns table (
  person_id          uuid,
  first_name         text,
  last_name          text,
  registered_at      timestamptz,
  registration_type  text,
  region             text
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  caller       uuid := auth.uid();
  window_start timestamptz;
begin
  if caller is null then
    raise exception 'unauthenticated';
  end if;
  if p_days is null or p_days < 1 then
    p_days := 30;
  end if;
  window_start := now() - (p_days || ' days')::interval;

  return query
    select p.id                as person_id,
           p.first_name         as first_name,
           p.last_name          as last_name,
           p.registered_at      as registered_at,
           p.registration_type  as registration_type,
           p.region             as region
      from public.persons p
     where p.deleted_at    is null
       and p.registered_at >= window_start
     order by p.registered_at desc;
end;
$$;

revoke execute on function public.servant_recent_newcomers(int) from public;
grant  execute on function public.servant_recent_newcomers(int) to authenticated;
