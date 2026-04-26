-- Rollback for 004_person_rpcs.sql
drop function if exists public.soft_delete_person(uuid);
drop function if exists public.assign_person(uuid, uuid, text);
drop function if exists public.update_person(uuid, jsonb);
drop function if exists public.create_person(jsonb);
drop function if exists public.get_person(uuid);
drop function if exists public.list_persons(jsonb);
drop function if exists public.is_assigned_servant(uuid);
