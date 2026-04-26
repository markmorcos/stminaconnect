-- 016_attendance_rpcs.sql
-- Mobile-facing RPCs for the attendance capability.
--
--   public.mark_attendance(p_event_id uuid, p_person_ids uuid[])    — any signed-in servant
--   public.unmark_attendance(p_event_id uuid, p_person_ids uuid[])  — any signed-in servant
--   public.get_event_attendance(p_event_id uuid)                    — any signed-in servant
--   public.search_persons(query text)                               — any signed-in servant
--
-- All four are SECURITY DEFINER. Mutating RPCs verify the edit window
-- via `is_event_within_edit_window` and reject outside-window calls
-- with `edit_window_closed`.
--
-- Why `p_event_id` and not `event_id`?
--   `attendance` has columns `event_id` and `person_id`, and the
--   `on conflict (event_id, person_id)` syntax in `mark_attendance`
--   requires bare column names. PL/pgSQL with the default
--   `variable_conflict = error` raises 42702 ("column reference is
--   ambiguous") if a parameter shadows the column. The fix is to
--   rename the parameter — same defensive pattern as `014_calendar_rpcs`
--   (which uses `new_pattern` instead of `pattern`).

-- ---------------------------------------------------------------------------
-- mark_attendance(p_event_id uuid, p_person_ids uuid[])
-- ---------------------------------------------------------------------------
-- Upserts is_present=true rows for each (event, person) pair in the
-- input. Sets `marked_by = auth.uid()`, `marked_at = now()`. Calling
-- twice with the same payload is idempotent — the unique (event_id,
-- person_id) constraint plus the ON CONFLICT clause coalesce the upsert.
--
-- Returns the number of rows actually upserted (inserted or updated).

create or replace function public.mark_attendance(p_event_id uuid, p_person_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  caller   uuid := auth.uid();
  affected int;
begin
  if caller is null then
    raise exception 'unauthenticated';
  end if;

  if p_person_ids is null or array_length(p_person_ids, 1) is null then
    return 0;
  end if;

  if not public.is_event_within_edit_window(p_event_id) then
    raise exception 'edit_window_closed';
  end if;

  insert into public.attendance (event_id, person_id, marked_by, marked_at, is_present)
    select p_event_id, pid, caller, now(), true
      from unnest(p_person_ids) as pid
    on conflict (event_id, person_id) do update
      set marked_by  = excluded.marked_by,
          marked_at  = excluded.marked_at,
          is_present = true;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke execute on function public.mark_attendance(uuid, uuid[]) from public;
grant execute on function public.mark_attendance(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- unmark_attendance(p_event_id uuid, p_person_ids uuid[])
-- ---------------------------------------------------------------------------
-- Deletes the rows for the given (event, person) pairs. Outside the
-- edit window the call raises `edit_window_closed` and no rows are
-- removed. Returns the number of rows deleted.

create or replace function public.unmark_attendance(p_event_id uuid, p_person_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  caller   uuid := auth.uid();
  affected int;
begin
  if caller is null then
    raise exception 'unauthenticated';
  end if;

  if p_person_ids is null or array_length(p_person_ids, 1) is null then
    return 0;
  end if;

  if not public.is_event_within_edit_window(p_event_id) then
    raise exception 'edit_window_closed';
  end if;

  delete from public.attendance
   where attendance.event_id  = p_event_id
     and attendance.person_id = any(p_person_ids);
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke execute on function public.unmark_attendance(uuid, uuid[]) from public;
grant execute on function public.unmark_attendance(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- get_event_attendance(p_event_id uuid)
-- ---------------------------------------------------------------------------
-- Returns the set of person_ids marked present for the event, plus
-- audit fields (`marked_by`, `marked_at`). Used by the roster screen
-- to render check states on entry.

create or replace function public.get_event_attendance(p_event_id uuid)
returns table(person_id uuid, marked_by uuid, marked_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select a.person_id, a.marked_by, a.marked_at
    from public.attendance a
   where a.event_id = p_event_id
     and a.is_present = true;
$$;

revoke execute on function public.get_event_attendance(uuid) from public;
grant execute on function public.get_event_attendance(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- search_persons(query text)
-- ---------------------------------------------------------------------------
-- ILIKE-on-name search across non-deleted persons. Returns at most 25
-- rows so the client never has to paginate. Projection is intentionally
-- small — the roster screen only needs a label.
--
-- Empty / whitespace-only queries return no rows so the search results
-- section stays empty until the servant types something.

create or replace function public.search_persons(query text)
returns table(id uuid, first_name text, last_name text, region text)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.first_name, p.last_name, p.region
    from public.persons p
   where p.deleted_at is null
     and length(coalesce(trim(query), '')) > 0
     and (p.first_name ilike '%' || trim(query) || '%'
          or p.last_name  ilike '%' || trim(query) || '%')
   order by p.last_name, p.first_name
   limit 25;
$$;

revoke execute on function public.search_persons(text) from public;
grant execute on function public.search_persons(text) to authenticated;
