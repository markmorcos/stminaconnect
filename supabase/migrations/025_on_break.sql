-- 025_on_break.sql
-- On-break lifecycle: dedicated mutators + a daily cron that auto-flips
-- expired breaks back to active and re-runs absence detection.
--
-- "Open-ended" breaks (per design decision 5 of add-followups-and-on-break)
-- are encoded as `paused_until = 9999-12-31` so the streak walk and the
-- cron job can reason uniformly without a separate nullable column.
--
-- Permissions: only the assigned servant or an admin can mutate break
-- state for a given person.

-- ---------------------------------------------------------------------------
-- mark_on_break(person_id, paused_until)
-- ---------------------------------------------------------------------------

create or replace function public.mark_on_break(
  p_person_id    uuid,
  p_paused_until date
)
returns public.persons
language plpgsql
security definer
set search_path = public
as $$
declare
  caller   uuid := auth.uid();
  existing public.persons;
  result   public.persons;
begin
  if caller is null then
    raise exception 'unauthenticated';
  end if;

  select * into existing from public.persons where id = p_person_id and deleted_at is null;
  if not found then
    raise exception 'person_not_found';
  end if;

  if not public.is_admin() and existing.assigned_servant <> caller then
    raise exception 'forbidden';
  end if;

  if p_paused_until is null then
    raise exception 'paused_until is required (use 9999-12-31 for open-ended)';
  end if;

  update public.persons
     set status       = 'on_break',
         paused_until = p_paused_until,
         updated_at   = now()
   where id = p_person_id
   returning * into result;

  return result;
end;
$$;

revoke execute on function public.mark_on_break(uuid, date) from public;
grant execute on function public.mark_on_break(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- end_break(person_id)
-- ---------------------------------------------------------------------------
-- Manual early termination. Flips status to 'active', clears paused_until,
-- and re-runs absence detection so any threshold crossings dispatch.

create or replace function public.end_break(p_person_id uuid)
returns public.persons
language plpgsql
security definer
set search_path = public
as $$
declare
  caller   uuid := auth.uid();
  existing public.persons;
  result   public.persons;
begin
  if caller is null then
    raise exception 'unauthenticated';
  end if;

  select * into existing from public.persons where id = p_person_id and deleted_at is null;
  if not found then
    raise exception 'person_not_found';
  end if;

  if not public.is_admin() and existing.assigned_servant <> caller then
    raise exception 'forbidden';
  end if;

  update public.persons
     set status       = 'active',
         paused_until = null,
         updated_at   = now()
   where id = p_person_id
   returning * into result;

  perform public.detect_absences(array[p_person_id]);

  return result;
end;
$$;

revoke execute on function public.end_break(uuid) from public;
grant execute on function public.end_break(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- expire_breaks() — invoked by daily cron
-- ---------------------------------------------------------------------------
-- Flips any person whose break has passed (paused_until <= today) back
-- to active. Then runs detection across the affected ids so any crossings
-- accumulated during the break dispatch alerts.

create or replace function public.expire_breaks()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_ids uuid[];
  affected_n   int;
begin
  with flipped as (
    update public.persons
       set status       = 'active',
           paused_until = null,
           updated_at   = now()
     where status       = 'on_break'
       and paused_until is not null
       and paused_until <= current_date
    returning id
  )
  select coalesce(array_agg(id), '{}'::uuid[]) into affected_ids from flipped;

  affected_n := array_length(affected_ids, 1);
  if affected_n is null then
    return 0;
  end if;

  perform public.detect_absences(affected_ids);
  return affected_n;
end;
$$;

revoke execute on function public.expire_breaks() from public;
grant execute on function public.expire_breaks() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- pg_cron schedule — daily 22:00 UTC ≈ 23:00 Europe/Berlin (CET).
-- Note: pg_cron uses UTC; during CEST this fires at 00:00 Berlin local.
-- That's close enough — the job is end-of-day cleanup, not a precise
-- cutover, and the spec ("23:00 Europe/Berlin") tolerates the DST drift.
-- ---------------------------------------------------------------------------

do $$
begin
  perform cron.unschedule('break-expiry-daily')
    where exists (select 1 from cron.job where jobname = 'break-expiry-daily');

  perform cron.schedule(
    'break-expiry-daily',
    '0 22 * * *',
    $cron$ select public.expire_breaks(); $cron$
  );
end$$;
