-- 021_compute_streak_cold_start.sql
-- Cold-start fix for absence detection.
--
-- Symptom: on a fresh install (or first deploy), past counted events
-- exist in the calendar but no attendance records have been entered for
-- them. Every active person trips the threshold immediately because the
-- streak walk treats every past event as a miss.
--
-- Fix: only count events whose `start_at >= persons.registered_at`.
-- A person can't be "absent" from events that happened before they were
-- tracked. Pastorally: a newcomer registered today must miss N future
-- counted events before the alert fires; an existing member registered
-- last year still has their full history considered.
--
-- Rationale: the documented behavior in design.md decision 1 is "walk
-- backwards through counted events whose start_at < T". The cold-start
-- filter is an additional lower bound that the original spec implicitly
-- assumed (events from before tracking began aren't real absences).

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
  streak int := 0;
  ev record;
  attended boolean;
begin
  select paused_until, registered_at
    into paused_until_d, registered_at_t
    from public.persons
   where id = p_person_id;

  -- No registered_at on the row → behave as if cold-start filter is off.
  -- (Defensive; the column is NOT NULL in v1.)
  if registered_at_t is null then
    registered_at_t := '1970-01-01'::timestamptz;
  end if;

  for ev in
    select id, start_at
      from public.events
     where is_counted = true
       and start_at < p_at
       and start_at >= registered_at_t
     order by start_at desc
  loop
    -- Skip events that fall inside the person's break window.
    -- Per design.md decision 1: skip when paused_until > event.start_at.
    -- paused_until is a date; we compare against its midnight timestamp.
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
