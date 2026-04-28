-- 034_audit_log.sql
-- GDPR Article 30 records-of-processing log. Append-only; admin-readable.
-- Writes go through `record_audit` (SECURITY DEFINER) in
-- 036_compliance_rpcs.sql — direct INSERTs from clients are denied.
--
-- Retention: rows older than 5 years are reaped by a future pg_cron job
-- (out of scope for v1; documented in docs/legal/retention.md).

create table if not exists public.audit_log (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid,
  action       text not null,
  target_type  text,
  target_id    uuid,
  payload      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists audit_log_actor_created_idx
  on public.audit_log (actor_id, created_at desc);

create index if not exists audit_log_target_idx
  on public.audit_log (target_type, target_id);

create index if not exists audit_log_action_created_idx
  on public.audit_log (action, created_at desc);

alter table public.audit_log enable row level security;

create policy audit_log_admin_read
  on public.audit_log
  for select
  using (public.is_admin());

-- No INSERT/UPDATE/DELETE policies — all writes go through `record_audit`.
