-- 014_calendar_rpcs.sql
-- Mobile-facing RPCs for the calendar capability.
--
--   public.get_today_events()                — any signed-in servant
--   public.list_counted_event_patterns()     — any signed-in servant
--   public.upsert_counted_event_pattern()    — admin only
--   public.delete_counted_event_pattern()    — admin only
--   public.trigger_calendar_sync()           — admin only, 1/min rate limit
--   public.get_last_sync_status()            — admin only
--
-- Pattern-mutating RPCs run an in-window recompute of `events.is_counted`
-- so admins see immediate effect on the screen.
--
-- `trigger_calendar_sync` reads the Edge Function URL from the Vault
-- entry `sync_calendar_function_url` and calls it via pg_net. If the
-- Vault entry is missing, the RPC raises a clear error.

-- ---------------------------------------------------------------------------
-- get_today_events()
-- ---------------------------------------------------------------------------

create or replace function public.get_today_events()
returns setof public.events
language sql
security definer
stable
set search_path = public
as $$
  select *
  from public.events
  where start_at >= date_trunc('day', timezone('Europe/Berlin', now())) at time zone 'Europe/Berlin'
    and start_at <  (date_trunc('day', timezone('Europe/Berlin', now())) + interval '1 day') at time zone 'Europe/Berlin'
  order by start_at asc;
$$;

revoke execute on function public.get_today_events() from public;
grant execute on function public.get_today_events() to authenticated;

-- ---------------------------------------------------------------------------
-- list_counted_event_patterns()
-- ---------------------------------------------------------------------------

create or replace function public.list_counted_event_patterns()
returns setof public.counted_event_patterns
language sql
security definer
stable
set search_path = public
as $$
  select * from public.counted_event_patterns order by created_at asc;
$$;

revoke execute on function public.list_counted_event_patterns() from public;
grant execute on function public.list_counted_event_patterns() to authenticated;

-- ---------------------------------------------------------------------------
-- upsert_counted_event_pattern(pattern text)
-- ---------------------------------------------------------------------------

-- The parameter is named `new_pattern` (not `pattern`) because the
-- table also has a `pattern` column — a same-named argument would
-- shadow it inside the INSERT … ON CONFLICT … DO UPDATE block and
-- raise "column reference 'pattern' is ambiguous".
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
      set pattern = excluded.pattern -- no-op so RETURNING fires on existing rows
    returning * into inserted;

  -- Recompute is_counted across the rolling window so the admin sees
  -- the new pattern reflected immediately. The WHERE clause is required
  -- because Supabase enables `pg_safeupdate` on the authenticator role,
  -- which rejects unqualified UPDATEs even from SECURITY DEFINER functions.
  -- The window matches what the sync Edge Function maintains.
  update public.events
     set is_counted = public.match_counted_event(title)
   where start_at >= now() - interval '30 days'
     and start_at <  now() + interval '14 days';

  return inserted;
end;
$$;

revoke execute on function public.upsert_counted_event_pattern(text) from public;
grant execute on function public.upsert_counted_event_pattern(text) to authenticated;

-- ---------------------------------------------------------------------------
-- delete_counted_event_pattern(id uuid)
-- ---------------------------------------------------------------------------

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

  -- See note in upsert_counted_event_pattern: WHERE clause is required
  -- by pg_safeupdate even from SECURITY DEFINER context.
  update public.events
     set is_counted = public.match_counted_event(title)
   where start_at >= now() - interval '30 days'
     and start_at <  now() + interval '14 days';

  return true;
end;
$$;

revoke execute on function public.delete_counted_event_pattern(uuid) from public;
grant execute on function public.delete_counted_event_pattern(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- trigger_calendar_sync() — admin, rate-limited 1/min
-- ---------------------------------------------------------------------------

create or replace function public.trigger_calendar_sync()
returns jsonb
language plpgsql
security definer
set search_path = public, net
as $$
declare
  recent_count int;
  fn_url text;
  fn_key text;
  request_id bigint;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  -- Rate limit: refuse if the last sync started < 60 seconds ago.
  select count(*) into recent_count
    from public.sync_log
   where started_at > now() - interval '1 minute';

  if recent_count > 0 then
    raise exception 'rate_limited: a sync was triggered within the last minute';
  end if;

  -- Resolve the Edge Function URL + auth from Vault. Both must be set.
  begin
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1'
      into fn_url
      using 'sync_calendar_function_url';
  exception when others then
    raise exception 'sync_calendar_function_url Vault secret not configured';
  end;

  begin
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1'
      into fn_key
      using 'sync_calendar_service_role_key';
  exception when others then
    raise exception 'sync_calendar_service_role_key Vault secret not configured';
  end;

  if fn_url is null or fn_key is null then
    raise exception 'sync_calendar_function_url or sync_calendar_service_role_key Vault secret missing';
  end if;

  select net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || fn_key
    ),
    body := '{}'::jsonb
  ) into request_id;

  return jsonb_build_object('request_id', request_id, 'outcome', 'queued');
end;
$$;

revoke execute on function public.trigger_calendar_sync() from public;
grant execute on function public.trigger_calendar_sync() to authenticated;

-- ---------------------------------------------------------------------------
-- get_last_sync_status() — admin
-- ---------------------------------------------------------------------------

create or replace function public.get_last_sync_status()
returns public.sync_log
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  row public.sync_log;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  select * into row
    from public.sync_log
   order by started_at desc
   limit 1;

  if not found then
    return null;
  end if;

  return row;
end;
$$;

revoke execute on function public.get_last_sync_status() from public;
grant execute on function public.get_last_sync_status() to authenticated;
