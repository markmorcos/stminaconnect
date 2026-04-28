-- 033_consent_log.sql
-- GDPR consent log: one row per acceptance event. The latest row per
-- user is consulted by the auth route guard before any authenticated
-- screen renders. History is preserved across version bumps.
--
-- RLS:
--   * a user can SELECT their own rows
--   * admins can SELECT every row
--   * INSERT/UPDATE go through SECURITY DEFINER RPCs in
--     036_compliance_rpcs.sql; direct writes are denied.

create table if not exists public.consent_log (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  policy_version  text not null,
  terms_version   text not null,
  accepted_at     timestamptz not null default now(),
  revoked_at      timestamptz
);

create index if not exists consent_log_user_accepted_idx
  on public.consent_log (user_id, accepted_at desc);

alter table public.consent_log enable row level security;

create policy consent_log_self_read
  on public.consent_log
  for select
  using (user_id = auth.uid());

create policy consent_log_admin_read_all
  on public.consent_log
  for select
  using (public.is_admin());
