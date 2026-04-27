-- 024_follow_ups.sql
-- Follow-ups capability: pastoral action logs against persons.
--
-- A follow-up is a single observation, not a thread:
--   - WHO did something (created_by → servants.id)
--   - WHO they did it to (person_id → persons.id)
--   - WHAT they did (action: called/texted/visited/no_answer/other)
--   - Optional notes (≤ 500 chars), status (completed/snoozed),
--     and a snooze_until date when status='snoozed'.
--
-- RLS:
--   * SELECT: creator OR admin.
--   * INSERT: any signed-in servant.
--   * UPDATE/DELETE: creator only, AND only within 1h of `created_at`.
-- The 1h immutability window keeps audit-style integrity without
-- requiring a separate audit log.

create table if not exists public.follow_ups (
  id           uuid primary key default gen_random_uuid(),
  person_id    uuid not null references public.persons (id) on delete cascade,
  created_by   uuid not null references public.servants (id),
  action       text not null check (action in ('called', 'texted', 'visited', 'no_answer', 'other')),
  notes        text check (notes is null or length(notes) <= 500),
  status       text not null check (status in ('completed', 'snoozed')),
  snooze_until date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint follow_ups_snoozed_requires_date check (
    (status = 'snoozed' and snooze_until is not null)
    or status = 'completed'
  )
);

create index if not exists follow_ups_person_idx          on public.follow_ups (person_id);
create index if not exists follow_ups_created_by_idx      on public.follow_ups (created_by);
create index if not exists follow_ups_status_snooze_idx   on public.follow_ups (status, snooze_until)
  where status = 'snoozed';
create index if not exists follow_ups_recent_idx          on public.follow_ups (created_by, created_at desc);

alter table public.follow_ups enable row level security;

create policy follow_ups_self_or_admin_read
  on public.follow_ups
  for select
  using (created_by = auth.uid() or public.is_admin());

-- No INSERT/UPDATE/DELETE policies on the table; all writes go through
-- the SECURITY DEFINER RPCs below which apply the 1h immutability rule.

-- ---------------------------------------------------------------------------
-- create_follow_up(payload jsonb)
-- ---------------------------------------------------------------------------

create or replace function public.create_follow_up(payload jsonb)
returns public.follow_ups
language plpgsql
security definer
set search_path = public
as $$
declare
  caller     uuid := auth.uid();
  person_id  uuid;
  inserted   public.follow_ups;
  v_action   text;
  v_status   text;
  v_snooze   date;
begin
  if caller is null then
    raise exception 'unauthenticated';
  end if;

  person_id := (payload->>'person_id')::uuid;
  if person_id is null then
    raise exception 'person_id is required';
  end if;

  v_action := payload->>'action';
  if v_action not in ('called', 'texted', 'visited', 'no_answer', 'other') then
    raise exception 'invalid action: %', coalesce(v_action, '<null>');
  end if;

  v_status := coalesce(payload->>'status', 'completed');
  if v_status not in ('completed', 'snoozed') then
    raise exception 'invalid status: %', v_status;
  end if;

  v_snooze := nullif(payload->>'snooze_until', '')::date;
  if v_status = 'snoozed' and v_snooze is null then
    raise exception 'snooze_until is required when status=snoozed';
  end if;

  insert into public.follow_ups (person_id, created_by, action, notes, status, snooze_until)
    values (
      person_id,
      caller,
      v_action,
      nullif(payload->>'notes', ''),
      v_status,
      v_snooze
    )
    returning * into inserted;

  return inserted;
end;
$$;

revoke execute on function public.create_follow_up(jsonb) from public;
grant execute on function public.create_follow_up(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- update_follow_up(id uuid, payload jsonb)
-- ---------------------------------------------------------------------------
-- Only the creator may update, and only within 1 hour of `created_at`.

create or replace function public.update_follow_up(p_id uuid, payload jsonb)
returns public.follow_ups
language plpgsql
security definer
set search_path = public
as $$
declare
  caller     uuid := auth.uid();
  existing   public.follow_ups;
  result     public.follow_ups;
  v_action   text;
  v_status   text;
  v_snooze   date;
begin
  if caller is null then
    raise exception 'unauthenticated';
  end if;

  select * into existing from public.follow_ups where id = p_id;
  if not found then
    raise exception 'follow_up not found';
  end if;

  if existing.created_by <> caller then
    raise exception 'forbidden';
  end if;

  if now() > existing.created_at + interval '1 hour' then
    raise exception 'follow_up_immutable';
  end if;

  v_action := coalesce(payload->>'action', existing.action);
  if v_action not in ('called', 'texted', 'visited', 'no_answer', 'other') then
    raise exception 'invalid action: %', v_action;
  end if;

  v_status := coalesce(payload->>'status', existing.status);
  if v_status not in ('completed', 'snoozed') then
    raise exception 'invalid status: %', v_status;
  end if;

  if payload ? 'snooze_until' then
    v_snooze := nullif(payload->>'snooze_until', '')::date;
  else
    v_snooze := existing.snooze_until;
  end if;

  if v_status = 'snoozed' and v_snooze is null then
    raise exception 'snooze_until is required when status=snoozed';
  end if;
  if v_status = 'completed' then
    v_snooze := null;
  end if;

  update public.follow_ups
     set action       = v_action,
         notes        = case when payload ? 'notes' then nullif(payload->>'notes', '') else notes end,
         status       = v_status,
         snooze_until = v_snooze,
         updated_at   = now()
   where id = p_id
   returning * into result;

  return result;
end;
$$;

revoke execute on function public.update_follow_up(uuid, jsonb) from public;
grant execute on function public.update_follow_up(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- list_follow_ups_pending(servant_id uuid default auth.uid())
-- ---------------------------------------------------------------------------
-- Returns the three-section dataset for the /follow-ups screen.
--
-- We tag each row with a `section` text so the client can group without
-- inferring from data shape. Sections:
--   - 'needs_follow_up'    — absence_alerts for the servant's persons,
--                            unresolved AND no follow_up exists for that
--                            (person, alert) pair.
--   - 'snoozed_returning'  — follow_ups created by the servant with
--                            status='snoozed' and snooze_until <= today + 1.
--   - 'recent'             — last 20 follow_ups by the servant in the
--                            past 14 days.
--
-- The result is a UNION of three projections; the client groups by
-- `section`. Person-level fields are returned for rendering.

create or replace function public.list_follow_ups_pending(p_servant_id uuid default null)
returns table(
  section          text,
  follow_up_id     uuid,
  alert_id         uuid,
  person_id        uuid,
  person_first     text,
  person_last      text,
  person_priority  text,
  action           text,
  notes            text,
  status           text,
  snooze_until     date,
  created_at       timestamptz,
  alert_streak     int,
  alert_crossed_at timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  servant_id uuid := coalesce(p_servant_id, auth.uid());
begin
  if servant_id is null then
    return;
  end if;

  return query
  -- Section 1: needs_follow_up
  select
    'needs_follow_up'::text                  as section,
    null::uuid                               as follow_up_id,
    a.id                                     as alert_id,
    p.id                                     as person_id,
    p.first_name                             as person_first,
    p.last_name                              as person_last,
    p.priority                               as person_priority,
    null::text                               as action,
    null::text                               as notes,
    null::text                               as status,
    null::date                               as snooze_until,
    a.crossed_at                             as created_at,
    a.streak_at_crossing                     as alert_streak,
    a.crossed_at                             as alert_crossed_at
  from public.absence_alerts a
  join public.persons p on p.id = a.person_id
  where a.resolved_at is null
    and (public.is_admin() or p.assigned_servant = servant_id)
    and not exists (
      select 1 from public.follow_ups f
       where f.person_id = a.person_id
         and f.created_at >= a.crossed_at
    )
  union all
  -- Section 2: snoozed_returning (today + tomorrow window)
  select
    'snoozed_returning'::text                as section,
    f.id                                     as follow_up_id,
    null::uuid                               as alert_id,
    p.id                                     as person_id,
    p.first_name                             as person_first,
    p.last_name                              as person_last,
    p.priority                               as person_priority,
    f.action                                 as action,
    f.notes                                  as notes,
    f.status                                 as status,
    f.snooze_until                           as snooze_until,
    f.created_at                             as created_at,
    null::int                                as alert_streak,
    null::timestamptz                        as alert_crossed_at
  from public.follow_ups f
  join public.persons p on p.id = f.person_id
  where f.created_by = servant_id
    and f.status = 'snoozed'
    and f.snooze_until <= current_date + 1
  union all
  -- Section 3: recent (last 20 in 14-day window). Disjoint from
  -- `snoozed_returning` — a follow-up that's about to return shows
  -- only in §2, not also here as "recently logged".
  select
    'recent'::text                           as section,
    f.id                                     as follow_up_id,
    null::uuid                               as alert_id,
    p.id                                     as person_id,
    p.first_name                             as person_first,
    p.last_name                              as person_last,
    p.priority                               as person_priority,
    f.action                                 as action,
    f.notes                                  as notes,
    f.status                                 as status,
    f.snooze_until                           as snooze_until,
    f.created_at                             as created_at,
    null::int                                as alert_streak,
    null::timestamptz                        as alert_crossed_at
  from (
    select fu.* from public.follow_ups fu
    where fu.created_by = servant_id
      and fu.created_at >= now() - interval '14 days'
      and not (fu.status = 'snoozed' and fu.snooze_until <= current_date + 1)
    order by fu.created_at desc
    limit 20
  ) f
  join public.persons p on p.id = f.person_id;
end;
$$;

revoke execute on function public.list_follow_ups_pending(uuid) from public;
grant execute on function public.list_follow_ups_pending(uuid) to authenticated;
