-- 018_alert_config.sql
-- Singleton table holding admin-tunable absence-detection knobs.
--
-- One row only — enforced by a BEFORE INSERT trigger that rejects a
-- second row. The seed INSERT in this migration creates the canonical
-- row; the trigger forbids any further INSERTs while permitting UPDATEs.
--
-- RLS:
--   * any signed-in servant SELECTs (the only row is shared config).
--   * INSERT / UPDATE / DELETE are denied at the table level — mutations
--     flow through the SECURITY DEFINER RPCs at the bottom of this file,
--     which gate on `is_admin()`.

create table if not exists public.alert_config (
  id                       uuid primary key default gen_random_uuid(),
  absence_threshold        int  not null default 3 check (absence_threshold >= 1),
  priority_thresholds      jsonb not null default '{}'::jsonb,
  notify_admin_on_alert    boolean not null default true,
  escalation_threshold     int  check (escalation_threshold is null or escalation_threshold >= 1),
  updated_at               timestamptz not null default now(),
  updated_by               uuid references public.servants (id)
);

-- Singleton enforcement: refuse a second INSERT.
create or replace function public.alert_config_singleton_guard()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.alert_config) > 0 then
    raise exception 'alert_config is a singleton; INSERT denied';
  end if;
  return new;
end;
$$;

drop trigger if exists alert_config_singleton on public.alert_config;
create trigger alert_config_singleton
  before insert on public.alert_config
  for each row
  execute function public.alert_config_singleton_guard();

-- Seed the canonical row with the documented defaults.
insert into public.alert_config (absence_threshold, priority_thresholds, notify_admin_on_alert)
values (
  3,
  '{"high": 2, "medium": 3, "low": 4, "very_low": 6}'::jsonb,
  true
);

alter table public.alert_config enable row level security;

create policy alert_config_authenticated_read
  on public.alert_config
  for select
  to authenticated
  using (true);

-- No client write policies. Mutations go through update_alert_config below.

-- ---------------------------------------------------------------------------
-- get_alert_config() — any signed-in servant
-- ---------------------------------------------------------------------------
-- Returns the singleton row. Used by the admin alerts settings screen.

create or replace function public.get_alert_config()
returns public.alert_config
language sql
security definer
stable
set search_path = public
as $$
  select * from public.alert_config order by updated_at desc limit 1;
$$;

revoke execute on function public.get_alert_config() from public;
grant execute on function public.get_alert_config() to authenticated;

-- ---------------------------------------------------------------------------
-- update_alert_config(...)
-- ---------------------------------------------------------------------------
-- Admin-only mutator. Each parameter is nullable; null means "leave the
-- existing value alone". Returns the updated row so the client can
-- refresh its cached form state.
--
-- `priority_thresholds` is replaced wholesale (not merged). The admin
-- screen always sends a complete map.

create or replace function public.update_alert_config(
  p_absence_threshold     int     default null,
  p_priority_thresholds   jsonb   default null,
  p_notify_admin_on_alert boolean default null,
  p_escalation_threshold  int     default null,
  p_clear_escalation      boolean default false
)
returns public.alert_config
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.alert_config;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  update public.alert_config
     set absence_threshold     = coalesce(p_absence_threshold, absence_threshold),
         priority_thresholds   = coalesce(p_priority_thresholds, priority_thresholds),
         notify_admin_on_alert = coalesce(p_notify_admin_on_alert, notify_admin_on_alert),
         escalation_threshold  = case
                                   when p_clear_escalation then null
                                   else coalesce(p_escalation_threshold, escalation_threshold)
                                 end,
         updated_at            = now(),
         updated_by            = auth.uid()
   where id = (select id from public.alert_config limit 1)
   returning * into result;

  return result;
end;
$$;

revoke execute on function public.update_alert_config(int, jsonb, boolean, int, boolean) from public;
grant execute on function public.update_alert_config(int, jsonb, boolean, int, boolean) to authenticated;
