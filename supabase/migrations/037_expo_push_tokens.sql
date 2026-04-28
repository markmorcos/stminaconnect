-- 037_expo_push_tokens.sql
-- Real-push prerequisite: per-servant Expo push token registry.
--
-- One servant may install on multiple devices (phone + tablet); each
-- device contributes one row. The `send-push-notification` Edge
-- Function fans the dispatch out to every active token. A token is
-- "active" when `deactivated_at is null` — sign-out, DeviceNotRegistered
-- receipts, and rotation all flip the column rather than DELETE so the
-- trail survives for audit.
--
-- RLS:
--   * a servant SELECTs only their own rows.
--   * admins SELECT all rows (matches the notifications table posture).
--   * no client INSERT/UPDATE/DELETE — writes go through the
--     SECURITY DEFINER RPCs below.

create table if not exists public.expo_push_tokens (
  id              uuid primary key default gen_random_uuid(),
  servant_id      uuid not null references public.servants (id) on delete cascade,
  token           text not null,
  device_info     jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  deactivated_at  timestamptz,
  unique (servant_id, token)
);

-- The send pipeline reads `where servant_id = $1 and deactivated_at is null`
-- on every dispatch; this index keeps that hot path on a single seek.
create index if not exists expo_push_tokens_active_idx
  on public.expo_push_tokens (servant_id, deactivated_at);

alter table public.expo_push_tokens enable row level security;

create policy expo_push_tokens_self_read
  on public.expo_push_tokens
  for select
  using (servant_id = auth.uid());

create policy expo_push_tokens_admin_read_all
  on public.expo_push_tokens
  for select
  using (public.is_admin());

-- register_push_token — upserts the (servant_id, token) row for the
-- caller. If the token already exists deactivated (e.g. previous
-- sign-out followed by sign-in on the same device), it is reactivated
-- and `last_seen_at` is bumped. The `device_info` jsonb is overwritten
-- with the latest payload — Platform.OS / app version may change across
-- launches and the freshest values are most useful for debugging.
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

  if token is null or length(trim(token)) = 0 then
    raise exception 'token must be non-empty';
  end if;

  insert into public.expo_push_tokens (servant_id, token, device_info, last_seen_at, deactivated_at)
    values (caller, token, coalesce(device_info, '{}'::jsonb), now(), null)
  on conflict (servant_id, token) do update
    set device_info    = coalesce(excluded.device_info, '{}'::jsonb),
        last_seen_at   = now(),
        deactivated_at = null;
end;
$$;

revoke execute on function public.register_push_token(text, jsonb) from public;
grant execute on function public.register_push_token(text, jsonb) to authenticated;

-- deactivate_push_token — flips `deactivated_at = now()` for the
-- caller's row matching the token. Idempotent: re-deactivating a token
-- that was already deactivated is a no-op (no error).
create or replace function public.deactivate_push_token(token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  affected int;
begin
  if caller is null then
    raise exception 'unauthenticated';
  end if;

  update public.expo_push_tokens
     set deactivated_at = now()
   where servant_id = caller
     and token = deactivate_push_token.token
     and deactivated_at is null;
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

revoke execute on function public.deactivate_push_token(text) from public;
grant execute on function public.deactivate_push_token(text) to authenticated;
