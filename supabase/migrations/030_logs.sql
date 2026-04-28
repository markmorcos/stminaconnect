-- 030_logs.sql
-- Structured log capture for production diagnostics.
--
-- Rows are inserted by `src/utils/logger.ts` whenever it emits at
-- `error` level in a production build (Expo Go / dev never hit the
-- network — see the wrapper). Admins read this surface from the
-- About / Diagnostics screen; non-admins cannot read it back.
--
-- RLS:
--   * SELECT: admin only.
--   * INSERT: any signed-in servant — the client should always be able
--     to record an error against their own session even if RLS would
--     otherwise hide it on read.
--   * UPDATE / DELETE: denied at the table level. Retention is handled
--     server-side by the nightly cron at the bottom of this file.

create table if not exists public.logs (
  id          uuid primary key default gen_random_uuid(),
  servant_id  uuid references public.servants (id),
  level       text not null check (level in ('debug', 'info', 'warn', 'error')),
  message     text not null,
  context     jsonb,
  app_version text,
  platform    text check (platform is null or platform in ('ios', 'android', 'web')),
  created_at  timestamptz not null default now()
);

create index if not exists logs_created_at_idx on public.logs (created_at desc);
create index if not exists logs_servant_id_idx on public.logs (servant_id);
create index if not exists logs_level_idx      on public.logs (level);

alter table public.logs enable row level security;

create policy logs_admin_read
  on public.logs
  for select
  using (public.is_admin());

create policy logs_authenticated_insert
  on public.logs
  for insert
  to authenticated
  with check (
    -- A row may only be attributed to the caller (or be unattributed,
    -- e.g. a sign-in error before the servant row resolved).
    servant_id is null or servant_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- prune_logs() — nightly retention cron deletes rows older than 7 days.
-- ---------------------------------------------------------------------------

create or replace function public.prune_logs()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  affected int;
begin
  delete from public.logs
   where created_at < now() - interval '7 days';
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke execute on function public.prune_logs() from public;
grant  execute on function public.prune_logs() to service_role;

-- pg_cron schedule: runs every day at 03:30 UTC (matches the
-- `add-google-calendar-sync` style of cron jobs in this project). The
-- one-week retention is documented in design.md decision 10.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'prune_logs_daily',
      '30 3 * * *',
      $cmd$select public.prune_logs();$cmd$
    );
  end if;
end;
$$;
