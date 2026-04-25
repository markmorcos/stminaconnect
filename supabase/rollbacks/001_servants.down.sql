-- Rollback for 001_servants.sql
drop function if exists public.get_my_servant();
drop policy if exists servants_admin_read_all on public.servants;
drop policy if exists servants_self_read on public.servants;
drop function if exists public.is_admin();
drop table if exists public.servants;
