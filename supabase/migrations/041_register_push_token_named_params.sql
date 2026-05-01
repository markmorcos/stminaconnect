-- 041_register_push_token_constraint_target.sql
-- Follow-up to 040: qualifying parameter refs in expression positions
-- wasn't enough. The bare `token` in `on conflict (servant_id, token)`
-- is a *column* reference position, but PL/pgSQL pre-substitutes scoped
-- variable names before the SQL parser runs — so the in-scope `token`
-- parameter still triggers SQLSTATE 42702 (ambiguous_column).
--
-- Fix without renaming the JSON-RPC parameters (which would force a
-- mobile rebuild): target the unique constraint by name instead of by
-- column list. The constraint is auto-named by Postgres from the inline
-- `unique (servant_id, token)` declaration in 037 — verify with:
--   select conname from pg_constraint
--    where conrelid = 'public.expo_push_tokens'::regclass
--      and contype = 'u';

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

  insert into public.expo_push_tokens as t (
    servant_id, token, device_info, last_seen_at, deactivated_at
  )
  values (
    caller,
    register_push_token.token,
    coalesce(register_push_token.device_info, '{}'::jsonb),
    now(),
    null
  )
  on conflict on constraint expo_push_tokens_servant_id_token_key do update
    set device_info    = coalesce(excluded.device_info, '{}'::jsonb),
        last_seen_at   = now(),
        deactivated_at = null;
end;
$$;
