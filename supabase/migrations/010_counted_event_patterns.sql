-- 010_counted_event_patterns.sql
-- Admin-configured list of substrings used by `match_counted_event`
-- to decide which Google Calendar events count toward absence streaks.
--
-- RLS:
--   * any signed-in servant may SELECT (used by future phases that
--     surface "this event is counted" in attendance UI).
--   * INSERT / UPDATE / DELETE flow through the admin RPCs in
--     014_calendar_rpcs.sql — no direct write policy.

create table if not exists public.counted_event_patterns (
  id          uuid primary key default gen_random_uuid(),
  pattern     text not null unique,
  created_by  uuid references public.servants (id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.counted_event_patterns enable row level security;

create policy counted_event_patterns_authenticated_read
  on public.counted_event_patterns
  for select
  to authenticated
  using (true);
