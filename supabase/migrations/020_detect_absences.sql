-- 020_detect_absences.sql
-- Absence detection: streak math + dispatch.
--
--   public.compute_streak(p_person_id uuid, p_at timestamptz default now())
--     returns int
--     Walks counted events backwards from `p_at`, counting consecutive
--     events with no matching `attendance` row for the person. Stops at
--     the first attended event. Events whose `start_at` falls within
--     the person's `paused_until` window are skipped (neither counted
--     as misses nor as resets — they're transparent).
--
--   public.detect_absences(p_person_ids uuid[] default null)
--     returns int   (number of new alerts dispatched, including primary
--                    and escalation, summed across recipients)
--     For each eligible person (active, not on_break/inactive, not
--     soft-deleted), computes the streak, looks up the applicable
--     threshold (priority-specific then global), and inserts a row
--     into `absence_alerts` with the appropriate `threshold_kind` if
--     not already present. The unique constraint on `(person_id,
--     threshold_kind, last_event_id)` guarantees idempotency. For each
--     newly-inserted alert row, dispatch_notification fires for every
--     recipient (assigned servant always; admins when configured).
--
-- The function is wired in three places:
--   1. After `mark_attendance` / `unmark_attendance` commit, with the
--      affected person ids — fast reactive path.
--   2. After `upsert_counted_event_pattern` / `delete_counted_event_pattern`
--      with NULL — full recompute when patterns change.
--   3. Hourly via pg_cron — safety net.
--
-- The hourly schedule is registered at the bottom of this migration.

-- ---------------------------------------------------------------------------
-- compute_streak(p_person_id, p_at)
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
  paused_until_d date;
  streak int := 0;
  ev record;
  attended boolean;
begin
  -- The person's break window (if any). When the event's start_at is
  -- before this date, we skip the event entirely — neither a miss nor
  -- a streak-breaker.
  select paused_until into paused_until_d
    from public.persons
   where id = p_person_id;

  for ev in
    select id, start_at
      from public.events
     where is_counted = true
       and start_at < p_at
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

-- ---------------------------------------------------------------------------
-- detect_absences(p_person_ids uuid[] default null)
-- ---------------------------------------------------------------------------
-- Returns the total number of new alert rows inserted (primary +
-- escalation summed). One notifications row is dispatched per recipient
-- per new alert.

create or replace function public.detect_absences(
  p_person_ids uuid[] default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg                public.alert_config;
  per_priority_thr   int;
  primary_thr        int;
  esc_thr            int;
  notify_admins      boolean;
  person_row         record;
  streak             int;
  last_evt_id        uuid;
  last_evt_title     text;
  last_evt_date      timestamptz;
  alert_id           uuid;
  payload            jsonb;
  recipient          uuid;
  inserted_total     int := 0;
begin
  select * into cfg from public.alert_config order by updated_at desc limit 1;
  if not found then
    -- No config row — nothing to do. Should never happen given the seed
    -- in 018_alert_config.sql, but defensive.
    return 0;
  end if;

  esc_thr       := cfg.escalation_threshold;
  notify_admins := cfg.notify_admin_on_alert;

  for person_row in
    select id, first_name, last_name, priority, assigned_servant
      from public.persons
     where deleted_at is null
       and status not in ('on_break', 'inactive')
       and (p_person_ids is null or id = any(p_person_ids))
  loop
    streak := public.compute_streak(person_row.id, now());

    if streak < 1 then
      continue;
    end if;

    -- Look up applicable primary threshold: priority-specific first,
    -- global as fallback.
    per_priority_thr := null;
    if cfg.priority_thresholds ? person_row.priority then
      begin
        per_priority_thr := (cfg.priority_thresholds ->> person_row.priority)::int;
      exception when others then
        per_priority_thr := null;
      end;
    end if;
    primary_thr := coalesce(per_priority_thr, cfg.absence_threshold);

    -- Identify the most recent counted event the person missed — this
    -- becomes `last_event_id` and pins the uniqueness key for the
    -- crossing.
    select id, title, start_at
      into last_evt_id, last_evt_title, last_evt_date
      from public.events
     where is_counted = true
       and start_at < now()
       and not exists (
         select 1
           from public.attendance a
          where a.event_id = events.id
            and a.person_id = person_row.id
            and a.is_present = true
       )
     order by start_at desc
     limit 1;

    -- Build the payload once (shared across recipients + threshold kinds).
    payload := jsonb_build_object(
      'personId',          person_row.id,
      'personName',        trim(person_row.first_name || ' ' || person_row.last_name),
      'consecutiveMisses', streak,
      'lastEventTitle',    coalesce(last_evt_title, ''),
      'lastEventDate',     coalesce(to_char(last_evt_date, 'YYYY-MM-DD"T"HH24:MI:SSOF'), ''),
      'priority',          person_row.priority,
      'thresholdKind',     'primary'
    );

    -- Primary crossing.
    if streak >= primary_thr then
      insert into public.absence_alerts (
        person_id, threshold_kind, last_event_id, streak_at_crossing
      )
      values (person_row.id, 'primary', last_evt_id, streak)
      on conflict (person_id, threshold_kind, last_event_id) do nothing
      returning id into alert_id;

      if alert_id is not null then
        inserted_total := inserted_total + 1;

        -- Always: assigned servant.
        insert into public.notifications (recipient_servant_id, type, payload)
          values (person_row.assigned_servant, 'absence_alert', payload);

        -- Plus admins (if configured) — excluding the assigned servant
        -- when they happen to also be an admin to avoid duplicate rows.
        if notify_admins then
          for recipient in
            select id from public.servants
             where role = 'admin'
               and id <> person_row.assigned_servant
               and deactivated_at is null
          loop
            insert into public.notifications (recipient_servant_id, type, payload)
              values (recipient, 'absence_alert', payload);
          end loop;
        end if;
      end if;
      alert_id := null;
    end if;

    -- Escalation crossing.
    if esc_thr is not null and streak >= esc_thr then
      payload := jsonb_set(payload, '{thresholdKind}', '"escalation"'::jsonb);

      insert into public.absence_alerts (
        person_id, threshold_kind, last_event_id, streak_at_crossing
      )
      values (person_row.id, 'escalation', last_evt_id, streak)
      on conflict (person_id, threshold_kind, last_event_id) do nothing
      returning id into alert_id;

      if alert_id is not null then
        inserted_total := inserted_total + 1;

        insert into public.notifications (recipient_servant_id, type, payload)
          values (person_row.assigned_servant, 'absence_alert', payload);

        if notify_admins then
          for recipient in
            select id from public.servants
             where role = 'admin'
               and id <> person_row.assigned_servant
               and deactivated_at is null
          loop
            insert into public.notifications (recipient_servant_id, type, payload)
              values (recipient, 'absence_alert', payload);
          end loop;
        end if;
      end if;
      alert_id := null;
    end if;
  end loop;

  return inserted_total;
end;
$$;

revoke execute on function public.detect_absences(uuid[]) from public;
grant execute on function public.detect_absences(uuid[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- recalculate_absences() — admin-only manual trigger
-- ---------------------------------------------------------------------------

create or replace function public.recalculate_absences()
returns int
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  return public.detect_absences(null);
end;
$$;

revoke execute on function public.recalculate_absences() from public;
grant execute on function public.recalculate_absences() to authenticated;

-- ---------------------------------------------------------------------------
-- Wire detection into mark_attendance / unmark_attendance.
-- We REPLACE the function bodies (defined in 016_attendance_rpcs.sql) so
-- they fire detection after their writes commit.
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

  -- Reactive detection for the affected persons. Fire-and-forget
  -- semantics aren't possible inside a single transaction; we run
  -- inline and absorb the cost (~ms for a handful of persons).
  perform public.detect_absences(p_person_ids);

  return affected;
end;
$$;

revoke execute on function public.mark_attendance(uuid, uuid[]) from public;
grant execute on function public.mark_attendance(uuid, uuid[]) to authenticated;

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

  perform public.detect_absences(p_person_ids);

  return affected;
end;
$$;

revoke execute on function public.unmark_attendance(uuid, uuid[]) from public;
grant execute on function public.unmark_attendance(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Wire detection into pattern upsert/delete RPCs.
-- A pattern change can flip `is_counted` on past events, retroactively
-- changing every streak in the system. Run a full recompute.
-- ---------------------------------------------------------------------------

create or replace function public.upsert_counted_event_pattern(new_pattern text)
returns public.counted_event_patterns
language plpgsql
security definer
set search_path = public
as $$
declare
  trimmed text := trim(new_pattern);
  inserted public.counted_event_patterns;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  if trimmed = '' then
    raise exception 'pattern must not be empty';
  end if;

  insert into public.counted_event_patterns (pattern, created_by)
    values (trimmed, auth.uid())
    on conflict (pattern) do update
      set pattern = excluded.pattern
    returning * into inserted;

  update public.events
     set is_counted = public.match_counted_event(title)
   where start_at >= now() - interval '30 days'
     and start_at <  now() + interval '14 days';

  perform public.detect_absences(null);

  return inserted;
end;
$$;

revoke execute on function public.upsert_counted_event_pattern(text) from public;
grant execute on function public.upsert_counted_event_pattern(text) to authenticated;

create or replace function public.delete_counted_event_pattern(pattern_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected int;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  delete from public.counted_event_patterns where id = pattern_id;
  get diagnostics affected = row_count;

  if affected = 0 then
    return false;
  end if;

  update public.events
     set is_counted = public.match_counted_event(title)
   where start_at >= now() - interval '30 days'
     and start_at <  now() + interval '14 days';

  perform public.detect_absences(null);

  return true;
end;
$$;

revoke execute on function public.delete_counted_event_pattern(uuid) from public;
grant execute on function public.delete_counted_event_pattern(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Hourly pg_cron safety-net schedule.
-- Mirrors the local-vs-vault dance in 013_pg_cron_sync_calendar.sql, but
-- the call here is a plain SQL function so we don't need any URL/key
-- secret — `select detect_absences(null);` runs in-database.
-- ---------------------------------------------------------------------------

do $$
begin
  -- Drop any prior schedule with this name so re-running is safe.
  perform cron.unschedule('detect-absences-hourly')
    where exists (select 1 from cron.job where jobname = 'detect-absences-hourly');

  perform cron.schedule(
    'detect-absences-hourly',
    '0 * * * *',
    $cron$ select public.detect_absences(null); $cron$
  );
end$$;
