-- 015_attendance.sql
-- Attendance capability — one row per (event, person) marked present.
-- Absence is implicit: a person without a row for an event is "absent"
-- (or, more precisely, "we don't know"). The set of present persons IS
-- the rows. `is_present` exists for future flexibility (explicit absence
-- in a later phase) but in v1 we never insert `false`.
--
-- RLS:
--   * any signed-in servant SELECTs every row
--   * INSERT / UPDATE / DELETE are denied at the table level — all
--     mutations go through the SECURITY DEFINER RPCs in 016_attendance_rpcs.sql
--
-- Edit window: `is_event_within_edit_window(event_id)` computes the
-- Berlin cutoff (03:00 the day after `start_at` in Europe/Berlin) and
-- is reused by both `mark_attendance` and `unmark_attendance`.

create table if not exists public.attendance (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events  (id) on delete cascade,
  person_id   uuid not null references public.persons (id),
  marked_by   uuid not null references public.servants(id),
  marked_at   timestamptz not null default now(),
  is_present  boolean not null default true,
  unique (event_id, person_id)
);

create index if not exists attendance_event_id_idx  on public.attendance (event_id);
create index if not exists attendance_person_id_idx on public.attendance (person_id);
create index if not exists attendance_marked_by_idx on public.attendance (marked_by);

alter table public.attendance enable row level security;

-- Any signed-in servant may SELECT — attendance is church-public.
create policy attendance_authenticated_read
  on public.attendance
  for select
  to authenticated
  using (true);

-- No client INSERT / UPDATE / DELETE policies. With RLS enabled and no
-- permissive write policy, direct mutations from the client are denied.
-- Mutations happen exclusively through the SECURITY DEFINER RPCs in
-- 016_attendance_rpcs.sql.

-- ---------------------------------------------------------------------------
-- is_event_within_edit_window(p_event_id uuid) returns boolean
-- ---------------------------------------------------------------------------
-- The cutoff is 03:00 Europe/Berlin on the day after the event's
-- `start_at` (Berlin-local). Computed by:
--   1. Converting `start_at` to its Berlin-local date.
--   2. Adding 1 day + 03:00 in Berlin local time.
--   3. Comparing now() to that instant.
--
-- Returns false when the event doesn't exist, so callers can short-circuit
-- on missing events with the same "not editable" branch they use for
-- closed windows.
--
-- Parameter is `p_event_id` (not `event_id`) because the `attendance`
-- table — and the conflict-target syntax in `mark_attendance` — uses
-- `event_id` as a column name. Same-name parameters trip PL/pgSQL's
-- variable_conflict=error guard with "column reference is ambiguous".

create or replace function public.is_event_within_edit_window(p_event_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  event_start timestamptz;
  cutoff      timestamptz;
begin
  select start_at into event_start
    from public.events
   where id = p_event_id;

  if event_start is null then
    return false;
  end if;

  -- Berlin local date of the event start, plus one day, at 03:00 Berlin —
  -- then convert that wall-clock back to UTC so it can be compared to now().
  cutoff := (
    (date_trunc('day', timezone('Europe/Berlin', event_start)) + interval '1 day 3 hours')
    at time zone 'Europe/Berlin'
  );

  return now() < cutoff;
end;
$$;

revoke execute on function public.is_event_within_edit_window(uuid) from public;
grant execute on function public.is_event_within_edit_window(uuid) to authenticated;
