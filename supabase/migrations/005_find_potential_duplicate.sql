-- 005_find_potential_duplicate.sql
-- Soft duplicate detection helper for the Quick Add flow.
-- The form calls this RPC before `create_person` so the servant can
-- decide whether to "Use existing" or "Save anyway". Exact-match on
-- phone (after stripping spaces) plus ILIKE on first/last names; the
-- most recently registered match wins so coptic-name false positives
-- surface the freshest candidate. Soft-deleted rows are excluded.
-- Returning NULL signals "no candidate, proceed".
--
-- Update to create_person: a non-admin caller can no longer impersonate
-- another servant via the payload — we substitute auth.uid() into
-- assigned_servant. Admins can still set it explicitly so they can
-- create on behalf of a servant who isn't on hand.

create or replace function public.find_potential_duplicate(
  first text,
  last  text,
  phone text
)
returns uuid
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  match_id uuid;
  norm_phone text := regexp_replace(coalesce(phone, ''), '\s+', '', 'g');
begin
  if auth.uid() is null then
    return null;
  end if;
  if first is null or last is null or norm_phone = '' then
    return null;
  end if;

  select p.id into match_id
  from public.persons p
  where p.deleted_at is null
    and p.first_name ilike first
    and p.last_name  ilike last
    and regexp_replace(coalesce(p.phone, ''), '\s+', '', 'g') = norm_phone
  order by p.registered_at desc
  limit 1;

  return match_id;
end;
$$;

revoke execute on function public.find_potential_duplicate(text, text, text) from public;
grant execute on function public.find_potential_duplicate(text, text, text) to authenticated;

-- Replace create_person so non-admin callers can't pick a different
-- assigned_servant. Schema and behavior of all other branches are
-- preserved verbatim from migration 004.
create or replace function public.create_person(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  effective_assigned uuid;
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
  if (payload->>'registration_type') not in ('quick_add', 'full') then
    raise exception 'registration_type must be one of quick_add, full';
  end if;

  -- Non-admin servants always end up as the assigned servant for rows
  -- they create — payload value (if any) is ignored. Admins may set it
  -- explicitly to register on behalf of another servant; if they omit
  -- it, default to themselves.
  if public.is_admin() then
    effective_assigned := coalesce(
      nullif(payload->>'assigned_servant', '')::uuid,
      caller
    );
  else
    effective_assigned := caller;
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
    effective_assigned,
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
