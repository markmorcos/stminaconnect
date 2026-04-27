-- 028_admin_servant_rpcs.sql
-- Admin-only servant lifecycle RPCs + a deactivation guard on
-- get_my_servant(), wired up so the Servants management screen and
-- invite-servant Edge Function in `add-admin-dashboard` have a stable
-- server contract.

-- ---------------------------------------------------------------------------
-- list_all_servants()
--   -> setof public.servants
--
-- Admin-only. Returns every servant row (active AND deactivated) so the
-- management screen can show the full roster with active state. The
-- existing `list_servants()` (006) returns active-only and is used by
-- the Full Registration form's assigned-servant picker — leaving it
-- alone keeps that callsite untouched.
-- ---------------------------------------------------------------------------
create or replace function public.list_all_servants()
returns setof public.servants
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  return query
    select *
      from public.servants
     order by deactivated_at nulls first, role desc, display_name asc, email asc;
end;
$$;

revoke execute on function public.list_all_servants() from public;
grant  execute on function public.list_all_servants() to authenticated;

-- ---------------------------------------------------------------------------
-- update_servant_role(p_servant_id uuid, p_role text)
--   -> public.servants
--
-- Admin-only. Promotes or demotes a servant. The role enum is enforced
-- by the column CHECK constraint. Refuses to demote the last admin so
-- the system always has at least one administrator.
-- ---------------------------------------------------------------------------
create or replace function public.update_servant_role(
  p_servant_id uuid,
  p_role       text
)
returns public.servants
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  result      public.servants;
  current_row public.servants;
  admin_count int;
begin
  if not public.is_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if p_role not in ('admin', 'servant') then
    raise exception 'invalid role: %', p_role using errcode = '22023';
  end if;

  select * into current_row
    from public.servants
   where id = p_servant_id
   for update;

  if not found then
    raise exception 'servant not found' using errcode = 'P0002';
  end if;

  if current_row.role = 'admin' and p_role = 'servant' then
    select count(*) into admin_count
      from public.servants
     where role = 'admin'
       and deactivated_at is null;
    if admin_count <= 1 then
      raise exception 'cannot demote the last active admin'
        using errcode = '23514';
    end if;
  end if;

  update public.servants
     set role = p_role,
         updated_at = now()
   where id = p_servant_id
   returning * into result;

  return result;
end;
$$;

revoke execute on function public.update_servant_role(uuid, text) from public;
grant  execute on function public.update_servant_role(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- deactivate_servant(p_servant_id uuid) -> public.servants
-- reactivate_servant(p_servant_id uuid) -> public.servants
--
-- Admin-only. Setting deactivated_at causes get_my_servant() to return
-- null on the deactivated user's next session refresh (see the modified
-- function below), forcing sign-out via the existing orphan-account
-- flow. Refuses to deactivate the last active admin (or the caller).
-- ---------------------------------------------------------------------------
create or replace function public.deactivate_servant(p_servant_id uuid)
returns public.servants
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  result      public.servants;
  current_row public.servants;
  admin_count int;
begin
  if not public.is_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if p_servant_id = auth.uid() then
    raise exception 'cannot deactivate your own account'
      using errcode = '23514';
  end if;

  select * into current_row
    from public.servants
   where id = p_servant_id
   for update;

  if not found then
    raise exception 'servant not found' using errcode = 'P0002';
  end if;

  if current_row.role = 'admin' then
    select count(*) into admin_count
      from public.servants
     where role = 'admin'
       and deactivated_at is null;
    if admin_count <= 1 then
      raise exception 'cannot deactivate the last active admin'
        using errcode = '23514';
    end if;
  end if;

  update public.servants
     set deactivated_at = now(),
         updated_at = now()
   where id = p_servant_id
   returning * into result;

  return result;
end;
$$;

revoke execute on function public.deactivate_servant(uuid) from public;
grant  execute on function public.deactivate_servant(uuid) to authenticated;

create or replace function public.reactivate_servant(p_servant_id uuid)
returns public.servants
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  result public.servants;
begin
  if not public.is_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  update public.servants
     set deactivated_at = null,
         updated_at = now()
   where id = p_servant_id
   returning * into result;

  if not found then
    raise exception 'servant not found' using errcode = 'P0002';
  end if;

  return result;
end;
$$;

revoke execute on function public.reactivate_servant(uuid) from public;
grant  execute on function public.reactivate_servant(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_my_servant() — modified
--
-- Returns null when the matching servant row has `deactivated_at` set,
-- in addition to the original "no row" case. The mobile auth flow
-- already signs the user out on null, so this single change effectively
-- enforces deactivation across the board (fresh sign-in and active
-- session refresh).
-- ---------------------------------------------------------------------------
create or replace function public.get_my_servant()
returns public.servants
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  result public.servants;
begin
  select * into result
  from public.servants
  where id = auth.uid()
  limit 1;

  if not found then
    return null;
  end if;

  if result.deactivated_at is not null then
    return null;
  end if;

  return result;
end;
$$;

revoke execute on function public.get_my_servant() from public;
grant  execute on function public.get_my_servant() to authenticated;
