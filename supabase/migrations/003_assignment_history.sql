-- 003_assignment_history.sql
-- Audit log of person ↔ servant assignment changes. A trigger on
-- `persons` writes a row whenever the assigned servant changes (and on
-- the initial INSERT). The optional `reason` is read from the
-- `request.assignment_reason` GUC, which `assign_person` sets per
-- transaction; direct dashboard edits log a null reason.

create table if not exists public.assignment_history (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references public.persons (id) on delete cascade,
  from_servant  uuid references public.servants (id),
  to_servant    uuid not null references public.servants (id),
  changed_by    uuid not null references public.servants (id),
  changed_at    timestamptz not null default now(),
  reason        text
);

create index if not exists assignment_history_person_id_idx on public.assignment_history (person_id);

alter table public.assignment_history enable row level security;
-- No permissive policies; client reads (when needed) go through a
-- dedicated RPC in a future phase.

create or replace function public.tg_persons_assignment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reason_in text := nullif(current_setting('request.assignment_reason', true), '');
  changer uuid := coalesce(auth.uid(), new.assigned_servant);
begin
  if tg_op = 'INSERT' then
    insert into public.assignment_history (person_id, from_servant, to_servant, changed_by, reason)
    values (new.id, null, new.assigned_servant, changer, reason_in);
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.assigned_servant is distinct from old.assigned_servant then
    insert into public.assignment_history (person_id, from_servant, to_servant, changed_by, reason)
    values (new.id, old.assigned_servant, new.assigned_servant, changer, reason_in);
  end if;
  return new;
end;
$$;

drop trigger if exists tg_persons_assignment_insert on public.persons;
create trigger tg_persons_assignment_insert
  after insert on public.persons
  for each row execute function public.tg_persons_assignment_change();

drop trigger if exists tg_persons_assignment_update on public.persons;
create trigger tg_persons_assignment_update
  after update of assigned_servant on public.persons
  for each row execute function public.tg_persons_assignment_change();
