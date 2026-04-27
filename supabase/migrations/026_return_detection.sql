-- 026_return_detection.sql
-- Return detection: when attendance is recorded for a person who has
-- one or more unresolved `absence_alerts`, mark those alerts resolved
-- and dispatch a `welcome_back` notification to the assigned servant.
--
-- Recipient policy is "assigned servant only" (per design decision 7
-- and Open Question D2 in add-followups-and-on-break/design.md). Admins
-- do NOT receive welcome-back notifications even when they receive
-- corresponding absence alerts — close-the-loop notifications are
-- pastoral, not administrative.
--
-- The new helper `detect_returns(p_event_id, p_person_ids)` runs inside
-- the same transaction as `mark_attendance`. The replaced
-- `mark_attendance` calls both `detect_absences` (existing) and
-- `detect_returns` (new) post-commit.

-- ---------------------------------------------------------------------------
-- detect_returns(p_event_id uuid, p_person_ids uuid[])
-- ---------------------------------------------------------------------------

create or replace function public.detect_returns(
  p_event_id   uuid,
  p_person_ids uuid[]
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  evt          record;
  person_row   record;
  unresolved_n int;
  payload      jsonb;
  total_sent   int := 0;
begin
  if p_person_ids is null or array_length(p_person_ids, 1) is null then
    return 0;
  end if;

  -- Pre-load event details for the welcome_back payload.
  select id, title, start_at into evt
    from public.events
   where id = p_event_id;
  if not found then
    return 0;
  end if;

  for person_row in
    select id, first_name, last_name, assigned_servant, priority, status
      from public.persons
     where id = any(p_person_ids)
       and deleted_at is null
  loop
    -- Resolve any unresolved alerts for this person. If at least one
    -- row was affected, dispatch a single welcome_back notification.
    update public.absence_alerts
       set resolved_at = now()
     where person_id  = person_row.id
       and resolved_at is null;
    get diagnostics unresolved_n = row_count;

    if unresolved_n > 0 then
      payload := jsonb_build_object(
        'personId',    person_row.id,
        'personName',  trim(person_row.first_name || ' ' || person_row.last_name),
        'eventTitle',  coalesce(evt.title, ''),
        'eventDate',   to_char(evt.start_at, 'YYYY-MM-DD"T"HH24:MI:SSOF')
      );

      insert into public.notifications (recipient_servant_id, type, payload)
        values (person_row.assigned_servant, 'welcome_back', payload);

      total_sent := total_sent + 1;
    end if;
  end loop;

  return total_sent;
end;
$$;

revoke execute on function public.detect_returns(uuid, uuid[]) from public;
grant execute on function public.detect_returns(uuid, uuid[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- mark_attendance — replaces 020_detect_absences.sql
-- Adds the `detect_returns` call post-commit alongside `detect_absences`.
-- Both run inside the RPC's transaction; failures abort the whole call,
-- which is desirable (a half-commit between the attendance row and the
-- alert/return side-effects would leave the system inconsistent).
-- ---------------------------------------------------------------------------

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

  -- Reactive absence-detection (idempotent on no-op crossings).
  perform public.detect_absences(p_person_ids);
  -- Return detection: resolves any unresolved alerts + dispatches
  -- welcome_back to the assigned servant.
  perform public.detect_returns(p_event_id, p_person_ids);

  return affected;
end;
$$;

revoke execute on function public.mark_attendance(uuid, uuid[]) from public;
grant execute on function public.mark_attendance(uuid, uuid[]) to authenticated;
