-- 007_servant_profile_rpcs.sql
-- Self-service profile RPCs for the servants table.
--
--   * `update_my_servant(display_name)` — caller updates their own row.
--     Used by the in-app account screen.
--   * `update_servant(servant_id, payload)` — admin-only; payload-shaped
--     mirror of `update_person`. Whitelists `display_name` for v1; unknown
--     keys are ignored without error so future fields can be added without
--     another migration.

create or replace function public.update_my_servant(display_name text)
returns public.servants
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  trimmed text;
  result public.servants;
begin
  if caller is null then
    raise exception 'unauthenticated';
  end if;

  trimmed := btrim(display_name);
  if trimmed = '' then
    raise exception 'display_name must not be empty';
  end if;
  if length(trimmed) > 100 then
    raise exception 'display_name too long';
  end if;

  update public.servants set
    display_name = trimmed,
    updated_at   = now()
  where id = caller
  returning * into result;

  if result.id is null then
    raise exception 'servant not found';
  end if;

  return result;
end;
$$;

revoke execute on function public.update_my_servant(text) from public;
grant execute on function public.update_my_servant(text) to authenticated;

create or replace function public.update_servant(servant_id uuid, payload jsonb)
returns public.servants
language plpgsql
security definer
set search_path = public
as $$
declare
  result   public.servants;
  trimmed  text;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  if payload ? 'display_name' then
    trimmed := btrim(payload->>'display_name');
    if trimmed = '' then
      raise exception 'display_name must not be empty';
    end if;
    if length(trimmed) > 100 then
      raise exception 'display_name too long';
    end if;
  end if;

  update public.servants set
    display_name = case when payload ? 'display_name' then btrim(payload->>'display_name') else display_name end,
    updated_at   = now()
  where id = servant_id
  returning * into result;

  if result.id is null then
    raise exception 'servant not found';
  end if;

  return result;
end;
$$;

revoke execute on function public.update_servant(uuid, jsonb) from public;
grant execute on function public.update_servant(uuid, jsonb) to authenticated;
