-- 006_update_person_revision.sql
-- Replaces update_person with field-level permission enforcement.
--
-- Permission rules (enforced server-side):
--   * Always allowed when caller is admin OR is_assigned_servant:
--       first_name, last_name, phone, region, language, registration_type
--   * Admin-only:
--       priority, status, paused_until
--   * Comments:
--       admin OR currently assigned servant
--   * assigned_servant:
--       MUST NOT be present in payload (use assign_person for history logging).
--
-- Errors are intentionally specific (e.g. 'forbidden_field:priority') so the
-- client can map them to localized messages.

create or replace function public.update_person(person_id uuid, payload jsonb)
returns public.persons
language plpgsql
security definer
set search_path = public
as $$
declare
  caller   uuid    := auth.uid();
  is_admin boolean := public.is_admin();
  is_assigned boolean;
  result   public.persons;
begin
  if caller is null then
    raise exception 'unauthenticated';
  end if;

  if payload ? 'assigned_servant' then
    raise exception 'forbidden_field:assigned_servant — use assign_person';
  end if;

  is_assigned := public.is_assigned_servant(person_id);

  if not is_admin and not is_assigned then
    raise exception 'forbidden';
  end if;

  -- Admin-only fields.
  if (payload ? 'priority') and not is_admin then
    raise exception 'forbidden_field:priority';
  end if;
  if (payload ? 'status') and not is_admin then
    raise exception 'forbidden_field:status';
  end if;
  if (payload ? 'paused_until') and not is_admin then
    raise exception 'forbidden_field:paused_until';
  end if;

  -- Comments require admin or assigned servant (already gated above), but
  -- be explicit so a non-assigned admin-less caller cannot slip a write in
  -- via a future code path.
  if (payload ? 'comments') and not (is_admin or is_assigned) then
    raise exception 'forbidden_field:comments';
  end if;

  -- registration_type is allowed (so quick_add → full upgrade works) for
  -- admin or assigned servant; constrained to known values.
  if (payload ? 'registration_type')
     and (payload->>'registration_type') not in ('quick_add', 'full') then
    raise exception 'registration_type must be one of quick_add, full';
  end if;

  if (payload ? 'language')
     and (payload->>'language') not in ('en', 'ar', 'de') then
    raise exception 'language must be one of en, ar, de';
  end if;

  update public.persons set
    first_name        = coalesce(payload->>'first_name', first_name),
    last_name         = coalesce(payload->>'last_name', last_name),
    phone             = case when payload ? 'phone'             then nullif(payload->>'phone', '')              else phone             end,
    region            = case when payload ? 'region'            then nullif(payload->>'region', '')             else region            end,
    language          = coalesce(payload->>'language', language),
    priority          = case when payload ? 'priority'          then payload->>'priority'                       else priority          end,
    comments          = case when payload ? 'comments'          then nullif(payload->>'comments', '')           else comments          end,
    paused_until      = case when payload ? 'paused_until'      then nullif(payload->>'paused_until', '')::date else paused_until      end,
    status            = case when payload ? 'status'            then payload->>'status'                         else status            end,
    registration_type = case when payload ? 'registration_type' then payload->>'registration_type'              else registration_type end,
    updated_at        = now()
  where id = person_id and deleted_at is null
  returning * into result;

  if result.id is null then
    raise exception 'person not found';
  end if;

  -- Strip comments from the returned row when the caller may not see them.
  if not is_admin and not is_assigned then
    result.comments := null;
  end if;

  return result;
end;
$$;

revoke execute on function public.update_person(uuid, jsonb) from public;
grant execute on function public.update_person(uuid, jsonb) to authenticated;

-- list_servants — returns all active servants. Admin-only because
-- non-admins cannot see other servants under the existing RLS policy
-- on `public.servants`. Used by the Full Registration form's
-- Assigned-Servant picker.
create or replace function public.list_servants()
returns setof public.servants
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  if not public.is_admin() then
    return;
  end if;
  return query
    select *
    from public.servants
    where deactivated_at is null
    order by display_name nulls last, email;
end;
$$;

revoke execute on function public.list_servants() from public;
grant execute on function public.list_servants() to authenticated;
