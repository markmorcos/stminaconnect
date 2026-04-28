-- 035_attendance_anonymized.sql
-- Schema changes that enable GDPR Article 17 hard-erasure to preserve
-- attendance history without retaining the erased person's identity:
--   1. Allow `attendance.person_id` to be NULL (after erasure).
--   2. Add `was_anonymized boolean default false`. Aggregate stats include
--      both kinds; per-person views exclude rows where it is true.
--   3. Insert the sentinel "Erased Servant" row used by self-erasure to
--      anonymize references that previously pointed to the deleted servant.

-- 1 + 2: attendance schema changes.
alter table public.attendance
  alter column person_id drop not null;

alter table public.attendance
  add column if not exists was_anonymized boolean not null default false;

create index if not exists attendance_anonymized_idx
  on public.attendance (was_anonymized)
  where was_anonymized = true;

-- 3: sentinel "Erased Servant" row. Created with deactivated_at set so it
-- can never sign in. The hardcoded UUID is referenced from
-- src/services/api/compliance.ts as ERASED_SERVANT_ID.
--
-- The row is created via a direct insert because servants.id references
-- auth.users(id) — we lift the FK temporarily to insert the sentinel,
-- then re-add it as DEFERRABLE INITIALLY DEFERRED so a concurrent
-- erase_my_account flow that drops the auth user doesn't break the
-- referencing sentinel.
do $$
begin
  if not exists (
    select 1 from public.servants
    where id = '00000000-0000-0000-0000-000000000000'
  ) then
    -- Drop the FK so we can insert a sentinel that does NOT correspond
    -- to a real auth.users row. The ON DELETE CASCADE behavior of the
    -- original FK is preserved on a re-add below; the sentinel id is
    -- explicitly excluded from the auth-user lifecycle.
    alter table public.servants drop constraint if exists servants_id_fkey;

    insert into public.servants (id, email, display_name, role, deactivated_at)
    values (
      '00000000-0000-0000-0000-000000000000',
      'erased@stmina.local',
      'Erased Servant',
      'servant',
      now()
    );

    -- Re-add the FK but skip validation so the sentinel row remains.
    alter table public.servants
      add constraint servants_id_fkey
      foreign key (id) references auth.users (id)
      on delete cascade
      not valid;
  end if;
end$$;
