-- 009_events.sql
-- Mirror of the church's Google Calendar within the rolling sync window
-- (30 days past, 14 days future). Single source of truth for events
-- consumed by the mobile client; never written to from the client.
--
-- Writes happen from the `sync-calendar-events` Edge Function (service
-- role, RLS-bypassing). The mobile client only ever SELECTs through the
-- `get_today_events` RPC introduced in 014_calendar_rpcs.sql.
--
-- `is_counted` is a persisted boolean computed at sync time by
-- `match_counted_event(title)` (010). Recomputed across the window when
-- an admin upserts or deletes a counted-event pattern.

create table if not exists public.events (
  id              uuid primary key default gen_random_uuid(),
  google_event_id text not null unique,
  title           text not null,
  description     text,
  start_at        timestamptz not null,
  end_at          timestamptz not null,
  is_counted      boolean not null default false,
  synced_at       timestamptz not null default now()
);

create index if not exists events_start_at_idx
  on public.events (start_at);

create index if not exists events_counted_start_idx
  on public.events (is_counted, start_at);

alter table public.events enable row level security;

-- All signed-in servants may SELECT events. Events are church-public.
create policy events_authenticated_read
  on public.events
  for select
  to authenticated
  using (true);

-- No client INSERT / UPDATE / DELETE policies. The Edge Function uses
-- the service role key and bypasses RLS; pattern-recompute mutations
-- live in SECURITY DEFINER RPCs that explicitly gate on `is_admin()`.
