-- 040_fix_register_push_token_ambiguity.sql
-- Fix: `register_push_token` raises SQLSTATE 42702 (ambiguous_column) on
-- hosted Postgres because the parameters `token` and `device_info` shadow
-- columns of the same name on `expo_push_tokens`. The `on conflict
-- (servant_id, token)` clause needs the column; the rest of the body
-- needs the parameter. Disambiguate by qualifying every parameter
-- reference with the function name — same pattern already used in
-- `deactivate_push_token` (037, line 103).

create or replace function public.register_push_token(
  token text,
  device_info jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'unauthenticated';
  end if;

  if register_push_token.token is null
     or length(trim(register_push_token.token)) = 0 then
    raise exception 'token must be non-empty';
  end if;

  insert into public.expo_push_tokens (
    servant_id, token, device_info, last_seen_at, deactivated_at
  )
  values (
    caller,
    register_push_token.token,
    coalesce(register_push_token.device_info, '{}'::jsonb),
    now(),
    null
  )
  on conflict (servant_id, token) do update
    set device_info    = coalesce(excluded.device_info, '{}'::jsonb),
        last_seen_at   = now(),
        deactivated_at = null;
end;
$$;
