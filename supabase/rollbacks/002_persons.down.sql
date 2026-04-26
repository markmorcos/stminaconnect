-- Rollback for 002_persons.sql
drop index if exists public.persons_active_idx;
drop index if exists public.persons_status_idx;
drop index if exists public.persons_region_idx;
drop index if exists public.persons_assigned_servant_idx;
drop table if exists public.persons cascade;
