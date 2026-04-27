-- 019_absence_alerts.sql
-- Tracks per-(person, threshold-kind, last-event) crossings so that
-- detect_absences can guarantee at-most-one alert per crossing through
-- a UNIQUE constraint, regardless of how many cadences (reactive,
-- scheduled, manual recalc) fire detection.
--
-- `resolved_at` is reserved for phase 12 (return-to-attendance) and
-- intentionally left null on insert in v1.
--
-- RLS:
--   * any signed-in servant may SELECT. The row is bookkeeping for the
--     detection pipeline; the actual user-facing artifact is the
--     `notifications` row dispatched in the same transaction.
--   * No client write policies; only `detect_absences` (SECURITY
--     DEFINER) inserts here.

create table if not exists public.absence_alerts (
  id                  uuid primary key default gen_random_uuid(),
  person_id           uuid not null references public.persons (id) on delete cascade,
  threshold_kind      text not null check (threshold_kind in ('primary', 'escalation')),
  last_event_id       uuid references public.events (id) on delete set null,
  streak_at_crossing  int  not null check (streak_at_crossing >= 1),
  crossed_at          timestamptz not null default now(),
  resolved_at         timestamptz,
  unique (person_id, threshold_kind, last_event_id)
);

create index if not exists absence_alerts_person_idx
  on public.absence_alerts (person_id);

create index if not exists absence_alerts_open_idx
  on public.absence_alerts (person_id, threshold_kind)
  where resolved_at is null;

alter table public.absence_alerts enable row level security;

create policy absence_alerts_authenticated_read
  on public.absence_alerts
  for select
  to authenticated
  using (true);
