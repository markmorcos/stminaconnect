-- 004_person_rpcs.sql
-- The full set of person RPCs. Every function is SECURITY DEFINER with
-- explicit `auth.uid()` / `is_admin()` gates inside. Client code calls
-- these via `supabase.rpc(...)`; direct table access is RLS-denied.

-- Helper: is the caller the assigned servant for this person?
create or replace function public.is_assigned_servant(person_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.persons p
    where p.id = person_id
      and p.assigned_servant = auth.uid()
  );
$$;

revoke execute on function public.is_assigned_servant(uuid) from public;
grant execute on function public.is_assigned_servant(uuid) to authenticated;

-- list_persons — public projection (no comments). Filterable on
-- assigned_servant, region, status, search (ILIKE on first/last name).
create or replace function public.list_persons(filter jsonb default '{}'::jsonb)
returns setof public.persons
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  f_assigned uuid := nullif(filter->>'assigned_servant', '')::uuid;
  f_region   text := nullif(filter->>'region', '');
  f_status   text := nullif(filter->>'status', '');
  f_search   text := nullif(filter->>'search', '');
begin
  if auth.uid() is null then
    return;
  end if;
  return query
    select
      id, first_name, last_name, phone, region, language, priority,
      assigned_servant,
      null::text as comments,
      status, paused_until, registration_type, registered_by, registered_at,
      created_at, updated_at, deleted_at
    from public.persons
    where deleted_at is null
      and (f_assigned is null or assigned_servant = f_assigned)
      and (f_region   is null or region = f_region)
      and (f_status   is null or status = f_status)
      and (
        f_search is null
        or first_name ilike '%' || f_search || '%'
        or last_name  ilike '%' || f_search || '%'
      )
    order by last_name, first_name;
end;
$$;

revoke execute on function public.list_persons(jsonb) from public;
grant execute on function public.list_persons(jsonb) to authenticated;

-- get_person — full row including comments only when caller is admin
-- or the currently assigned servant.
create or replace function public.get_person(person_id uuid)
returns public.persons
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  result public.persons;
begin
  if auth.uid() is null then
    return null;
  end if;
  select * into result
  from public.persons
  where id = person_id and deleted_at is null;
  if not found then
    return null;
  end if;
  if not public.is_admin() and result.assigned_servant <> auth.uid() then
    result.comments := null;
  end if;
  return result;
end;
$$;

revoke execute on function public.get_person(uuid) from public;
grant execute on function public.get_person(uuid) to authenticated;

-- create_person — validates required fields, sets server-side defaults.
create or replace function public.create_person(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  new_id uuid;
begin
  if caller is null then
    raise exception 'unauthenticated';
  end if;
  if (payload->>'first_name') is null or btrim(payload->>'first_name') = '' then
    raise exception 'first_name is required';
  end if;
  if (payload->>'last_name') is null or btrim(payload->>'last_name') = '' then
    raise exception 'last_name is required';
  end if;
  if (payload->>'language') not in ('en', 'ar', 'de') then
    raise exception 'language must be one of en, ar, de';
  end if;
  if (payload->>'assigned_servant') is null then
    raise exception 'assigned_servant is required';
  end if;
  if (payload->>'registration_type') not in ('quick_add', 'full') then
    raise exception 'registration_type must be one of quick_add, full';
  end if;

  insert into public.persons (
    first_name, last_name, phone, region, language, priority,
    assigned_servant, comments, status, paused_until, registration_type,
    registered_by, registered_at
  ) values (
    payload->>'first_name',
    payload->>'last_name',
    nullif(payload->>'phone', ''),
    nullif(payload->>'region', ''),
    payload->>'language',
    coalesce(payload->>'priority', 'medium'),
    (payload->>'assigned_servant')::uuid,
    nullif(payload->>'comments', ''),
    coalesce(payload->>'status', 'new'),
    nullif(payload->>'paused_until', '')::date,
    payload->>'registration_type',
    caller,
    now()
  )
  returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function public.create_person(jsonb) from public;
grant execute on function public.create_person(jsonb) to authenticated;

-- update_person — whitelists the editable fields; admin-only fields
-- (`status`) are gated on is_admin().
create or replace function public.update_person(person_id uuid, payload jsonb)
returns public.persons
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  result public.persons;
begin
  if caller is null then
    raise exception 'unauthenticated';
  end if;
  if not public.is_admin() and not public.is_assigned_servant(person_id) then
    raise exception 'forbidden';
  end if;

  update public.persons set
    first_name   = coalesce(payload->>'first_name', first_name),
    last_name    = coalesce(payload->>'last_name', last_name),
    phone        = case when payload ? 'phone'        then nullif(payload->>'phone', '')               else phone        end,
    region       = case when payload ? 'region'       then nullif(payload->>'region', '')              else region       end,
    language     = coalesce(payload->>'language', language),
    priority     = coalesce(payload->>'priority', priority),
    comments     = case when payload ? 'comments'     then nullif(payload->>'comments', '')            else comments     end,
    paused_until = case when payload ? 'paused_until' then nullif(payload->>'paused_until', '')::date  else paused_until end,
    status       = case
                     when payload ? 'status' and public.is_admin() then payload->>'status'
                     else status
                   end,
    updated_at   = now()
  where id = person_id and deleted_at is null
  returning * into result;

  if result.id is null then
    raise exception 'person not found';
  end if;
  return result;
end;
$$;

revoke execute on function public.update_person(uuid, jsonb) from public;
grant execute on function public.update_person(uuid, jsonb) to authenticated;

-- assign_person — admin only. The trigger logs the history row;
-- `request.assignment_reason` is set per-transaction so the trigger
-- can stamp the reason on the inserted row.
create or replace function public.assign_person(person_id uuid, servant_id uuid, reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  perform set_config('request.assignment_reason', coalesce(reason, ''), true);
  update public.persons set
    assigned_servant = servant_id,
    updated_at       = now()
  where id = person_id and deleted_at is null;
  if not found then
    raise exception 'person not found';
  end if;
end;
$$;

revoke execute on function public.assign_person(uuid, uuid, text) from public;
grant execute on function public.assign_person(uuid, uuid, text) to authenticated;

-- soft_delete_person — admin only. Sets deleted_at + scrubs PII.
-- Attendance rows (added in a later phase) keep their FK to the row.
create or replace function public.soft_delete_person(person_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  update public.persons set
    deleted_at = now(),
    first_name = 'Removed',
    last_name  = 'Member',
    phone      = null,
    comments   = null,
    updated_at = now()
  where id = person_id and deleted_at is null;
  if not found then
    raise exception 'person not found or already deleted';
  end if;
end;
$$;

revoke execute on function public.soft_delete_person(uuid) from public;
grant execute on function public.soft_delete_person(uuid) to authenticated;
