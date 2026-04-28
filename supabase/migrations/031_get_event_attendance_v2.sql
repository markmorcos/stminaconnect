-- 031_get_event_attendance_v2.sql
-- Extend the read projection so historical roster views can render
-- soft-deleted persons as "Removed Member" without losing the audit
-- trail.
--
-- The base table (`attendance`) keeps its FK to `persons` even when a
-- person is soft-deleted (`deleted_at` set, PII scrubbed elsewhere).
-- The previous projection returned only `person_id` + audit fields,
-- which forced clients to JOIN client-side. The new projection adds:
--
--   - person_first / person_last  — the names as they were captured
--     (post-scrub for deleted rows; design-time servers may have
--     "[Removed]" or NULL for these — clients fall back on their
--     translation key).
--   - is_deleted                  — true when the person row has a
--     non-null `deleted_at`. Drives the "Removed Member" UI in
--     historical roster views.

-- Postgres rejects `CREATE OR REPLACE` when the OUT-parameter (RETURNS
-- TABLE) shape changes, so drop the prior signature first. The DROP is
-- IF EXISTS-guarded so the migration also runs cleanly on a fresh DB
-- where 016 hasn't been applied yet (defensive — in practice 016 is
-- always applied before us).
drop function if exists public.get_event_attendance(uuid);

create function public.get_event_attendance(p_event_id uuid)
returns table (
  person_id    uuid,
  person_first text,
  person_last  text,
  is_deleted   boolean,
  marked_by    uuid,
  marked_at    timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select a.person_id,
         p.first_name                  as person_first,
         p.last_name                   as person_last,
         (p.deleted_at is not null)    as is_deleted,
         a.marked_by,
         a.marked_at
    from public.attendance a
    join public.persons    p on p.id = a.person_id
   where a.event_id = p_event_id
     and a.is_present = true;
$$;

revoke execute on function public.get_event_attendance(uuid) from public;
grant  execute on function public.get_event_attendance(uuid) to authenticated;
