-- Rollback for 005_find_potential_duplicate.sql
-- Drops the new RPC and restores the previous create_person body
-- (which required assigned_servant in the payload and trusted it
-- regardless of caller role).
drop function if exists public.find_potential_duplicate(text, text, text);

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
