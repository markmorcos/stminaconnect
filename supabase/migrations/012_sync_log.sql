-- 012_sync_log.sql
-- Lightweight audit/observability log for the calendar sync. The Edge
-- Function writes one row per invocation (open on entry, close on
-- exit/error). The admin counted-events screen reads the latest row to
-- show "Last sync: 5 minutes ago — Success / Error".
--
-- RLS:
--   * admins SELECT all rows.
--   * other clients have no policy → no read access.
--   * writes happen from the Edge Function with the service role key,
--     bypassing RLS.
--
-- Retention: keep last 100 rows, trimmed via AFTER INSERT trigger.

create table if not exists public.sync_log (
  id           uuid primary key default gen_random_uuid(),
  source       text not null default 'calendar',
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  outcome      text not null default 'running'
                check (outcome in ('running', 'success', 'error')),
  error        text,
  upserted     integer,
  deleted      integer
);

create index if not exists sync_log_started_at_idx
  on public.sync_log (started_at desc);

alter table public.sync_log enable row level security;

create policy sync_log_admin_read_all
  on public.sync_log
  for select
  using (public.is_admin());

create or replace function public._trim_sync_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.sync_log
  where id in (
    select id
    from public.sync_log
    order by started_at desc
    offset 100
  );
  return null;
end;
$$;

drop trigger if exists trim_sync_log on public.sync_log;
create trigger trim_sync_log
  after insert on public.sync_log
  for each statement
  execute function public._trim_sync_log();
