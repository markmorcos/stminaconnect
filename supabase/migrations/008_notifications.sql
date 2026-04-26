-- 008_notifications.sql
-- Notifications capability — server-side source of truth.
--
-- The mobile app's `MockNotificationService` subscribes to INSERT events
-- on this table via Supabase Realtime; the future real-push dispatcher
-- (phase 17) writes to the same table as the canonical inbox.
--
-- RLS:
--   * a servant SELECTs only their own row (`recipient_servant_id = auth.uid()`)
--   * admins SELECT all rows
--   * no client INSERT/UPDATE/DELETE policies — those go through the
--     SECURITY DEFINER RPCs below.

create table if not exists public.notifications (
  id                     uuid primary key default gen_random_uuid(),
  recipient_servant_id   uuid not null references public.servants (id) on delete cascade,
  type                   text not null
                          check (type in ('absence_alert', 'welcome_back', 'reassignment', 'system')),
  payload                jsonb not null default '{}'::jsonb,
  read_at                timestamptz,
  created_at             timestamptz not null default now()
);

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_servant_id, created_at desc);

create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_servant_id)
  where read_at is null;

alter table public.notifications enable row level security;

create policy notifications_self_read
  on public.notifications
  for select
  using (recipient_servant_id = auth.uid());

create policy notifications_admin_read_all
  on public.notifications
  for select
  using (public.is_admin());

-- dispatch_notification — admin-only entry point for inserting a row.
-- Edge Functions in later phases call this RPC with the service role key
-- (which bypasses the admin check). Direct calls from the mobile client
-- only succeed when the caller is an admin servant.
create or replace function public.dispatch_notification(
  recipient uuid,
  type text,
  payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'admin only';
  end if;

  if type not in ('absence_alert', 'welcome_back', 'reassignment', 'system') then
    raise exception 'invalid notification type: %', type;
  end if;

  insert into public.notifications (recipient_servant_id, type, payload)
    values (recipient, type, coalesce(payload, '{}'::jsonb))
  returning id into new_id;

  return new_id;
end;
$$;

revoke execute on function public.dispatch_notification(uuid, text, jsonb) from public;
grant execute on function public.dispatch_notification(uuid, text, jsonb) to authenticated;

-- mark_notification_read — sets read_at for the caller's own notification.
-- Returns true when a row was updated, false otherwise.
create or replace function public.mark_notification_read(notification_id uuid)
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

  update public.notifications
     set read_at = now()
   where id = notification_id
     and recipient_servant_id = caller
     and read_at is null;
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

revoke execute on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;

-- mark_all_notifications_read — bulk update for the caller. Returns the
-- number of rows that were flipped from unread to read.
create or replace function public.mark_all_notifications_read()
returns integer
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

  update public.notifications
     set read_at = now()
   where recipient_servant_id = caller
     and read_at is null;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke execute on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- unread_notifications_count — convenience for the home-screen badge.
-- security definer so the count is computed without relying on RLS being
-- selectable by the caller; identity is auth.uid().
create or replace function public.unread_notifications_count()
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::int
  from public.notifications
  where recipient_servant_id = auth.uid()
    and read_at is null;
$$;

revoke execute on function public.unread_notifications_count() from public;
grant execute on function public.unread_notifications_count() to authenticated;

-- Realtime: include the notifications table in the supabase_realtime
-- publication so MockNotificationService can subscribe to INSERT events.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.notifications;
    exception when duplicate_object then
      -- already in the publication; nothing to do
      null;
    end;
  end if;
end$$;
