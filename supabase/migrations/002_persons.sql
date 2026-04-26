-- 002_persons.sql
-- Adds the `persons` table — the single source of truth for member records.
-- Direct client access is denied (RLS enabled, no permissive policies).
-- Reads/writes go through SECURITY DEFINER RPCs in 004_person_rpcs.sql.

create table if not exists public.persons (
  id                 uuid primary key default gen_random_uuid(),
  first_name         text not null,
  last_name          text not null,
  phone              text,
  region             text,
  language           text not null check (language in ('en', 'ar', 'de')),
  priority           text not null default 'medium'
                       check (priority in ('high', 'medium', 'low', 'very_low')),
  assigned_servant   uuid not null references public.servants (id),
  comments           text,
  status             text not null default 'new'
                       check (status in ('new', 'active', 'inactive', 'on_break')),
  paused_until       date,
  registration_type  text not null
                       check (registration_type in ('quick_add', 'full')),
  registered_by      uuid not null references public.servants (id),
  registered_at      timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

create index if not exists persons_assigned_servant_idx on public.persons (assigned_servant);
create index if not exists persons_region_idx           on public.persons (region);
create index if not exists persons_status_idx           on public.persons (status);
create index if not exists persons_active_idx           on public.persons (id) where deleted_at is null;

alter table public.persons enable row level security;
-- No permissive policies are created; with RLS enabled, SELECT returns
-- zero rows for `authenticated` and `anon`, while INSERT/UPDATE/DELETE
-- raise an RLS violation. All client access goes through the RPCs in
-- 004_person_rpcs.sql.
