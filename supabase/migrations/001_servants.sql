-- 001_servants.sql
-- Adds the `servants` table — minimal v1 shape for the auth capability.
-- A `servants` row exists for every authenticated app user; `auth.users`
-- proves identity, `servants` carries display name and role.

create table if not exists public.servants (
  id              uuid primary key references auth.users (id) on delete cascade,
  email           text not null,
  display_name    text,
  role            text not null default 'servant'
                   check (role in ('admin', 'servant')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deactivated_at  timestamptz
);

create index if not exists servants_role_idx on public.servants (role);

alter table public.servants enable row level security;

-- Helper: returns true when the caller is an admin servant.
-- security definer breaks the RLS recursion that an inline subquery
-- against `public.servants` would cause inside the admin-read policy.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.servants
    where id = auth.uid()
      and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- A servant can read their own row.
create policy servants_self_read
  on public.servants
  for select
  using (auth.uid() = id);

-- Admins can read every row.
create policy servants_admin_read_all
  on public.servants
  for select
  using (public.is_admin());

-- Writes from the client are denied: no insert/update/delete policies
-- exist. Admins manage rows via the Supabase Dashboard until the
-- in-app admin RPC ships in phase 13.

-- get_my_servant — returns the calling user's servant row, or null.
-- security definer so it can read the row regardless of RLS posture
-- on the caller's session; auth.uid() is still the source of identity.
-- Implemented in plpgsql so we can return NULL (not a row of NULLs)
-- when no matching servant exists — PostgREST then surfaces it as
-- JSON `null` rather than a record full of null fields.
create or replace function public.get_my_servant()
returns public.servants
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  result public.servants;
begin
  select * into result
  from public.servants
  where id = auth.uid()
  limit 1;

  if not found then
    return null;
  end if;

  return result;
end;
$$;

revoke execute on function public.get_my_servant() from public;
grant execute on function public.get_my_servant() to authenticated;
