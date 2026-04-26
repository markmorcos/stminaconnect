-- Rollback for 003_assignment_history.sql
drop trigger if exists tg_persons_assignment_update on public.persons;
drop trigger if exists tg_persons_assignment_insert on public.persons;
drop function if exists public.tg_persons_assignment_change();
drop index if exists public.assignment_history_person_id_idx;
drop table if exists public.assignment_history;
