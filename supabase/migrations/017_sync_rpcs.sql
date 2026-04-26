-- 017_sync_rpcs.sql
-- Delta-sync RPCs consumed by the mobile SyncEngine (capability:
-- offline-sync, change: add-offline-sync-with-sqlite).
--
-- Each `sync_*_since(since timestamptz)` RPC returns the rows the
-- client needs to apply since its last successful pull, plus deletions
-- where applicable. The client passes `null` (or epoch zero) on first
-- launch to receive a full snapshot within the rolling window.
--
-- Why a separate file (not bolted onto the per-table RPC migrations)?
-- The sync layer is cross-cutting; keeping all of it here makes the
-- read path (delta queries) easy to reason about when extending later
-- (more tables, more deletion-tracking).

-- ---------------------------------------------------------------------------
-- attendance_deletions
-- ---------------------------------------------------------------------------
-- Soft trail of unmark_attendance ops so the client can converge on
-- removed rows. Populated by the trigger below; only the (event,
-- person, deleted_at) tuple is needed — the client uses it to delete
-- the matching local row.

create table if not exists public.attendance_deletions (
  event_id   uuid not null,
  person_id  uuid not null,
  deleted_at timestamptz not null default now(),
  primary key (event_id, person_id, deleted_at)
);

create index if not exists attendance_deletions_deleted_at_idx
  on public.attendance_deletions (deleted_at);

alter table public.attendance_deletions enable row level security;

create policy attendance_deletions_authenticated_read
  on public.attendance_deletions
  for select
  to authenticated
  using (true);

-- Trigger: every DELETE from public.attendance writes a tombstone.
-- `unmark_attendance` is the only mutator (RLS denies direct DELETE),
-- so this captures everything servants can produce.
create or replace function public.attendance_after_delete_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.attendance_deletions (event_id, person_id, deleted_at)
    values (old.event_id, old.person_id, now())
  on conflict do nothing;
  return old;
end;
$$;

drop trigger if exists attendance_after_delete on public.attendance;
create trigger attendance_after_delete
  after delete on public.attendance
  for each row
  execute function public.attendance_after_delete_record();

-- ---------------------------------------------------------------------------
-- sync_persons_since(since timestamptz)
-- ---------------------------------------------------------------------------
-- Returns persons rows where `updated_at >= since` OR `deleted_at >= since`.
-- Soft-deletion is encoded via the existing `deleted_at` column — the
-- client deletes the matching local row when it sees a non-null
-- `deleted_at`.
--
-- Visibility:
--   * non-admin servants only see rows assigned to them OR registered by them.
--   * admins see everything.
--   * `comments` is masked to NULL for non-admin / non-assigned callers
--     (mirrors the get_person rule from 004_person_rpcs.sql).
--
-- Pass `null` for `since` on first launch to receive a full snapshot.

create or replace function public.sync_persons_since(since timestamptz)
returns table(
  id                 uuid,
  first_name         text,
  last_name          text,
  phone              text,
  region             text,
  language           text,
  priority           text,
  assigned_servant   uuid,
  comments           text,
  status             text,
  paused_until       date,
  registration_type  text,
  registered_by      uuid,
  registered_at      timestamptz,
  created_at         timestamptz,
  updated_at         timestamptz,
  deleted_at         timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.id,
    p.first_name,
    p.last_name,
    p.phone,
    p.region,
    p.language,
    p.priority,
    p.assigned_servant,
    case
      when public.is_admin() then p.comments
      when p.assigned_servant = auth.uid() then p.comments
      when p.registered_by   = auth.uid() then p.comments
      else null
    end as comments,
    p.status,
    p.paused_until,
    p.registration_type,
    p.registered_by,
    p.registered_at,
    p.created_at,
    p.updated_at,
    p.deleted_at
  from public.persons p
  where (since is null
         or p.updated_at >= since
         or (p.deleted_at is not null and p.deleted_at >= since))
    and (
      public.is_admin()
      or p.assigned_servant = auth.uid()
      or p.registered_by   = auth.uid()
    )
  order by p.updated_at asc;
$$;

revoke execute on function public.sync_persons_since(timestamptz) from public;
grant execute on function public.sync_persons_since(timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- sync_events_since(since timestamptz)
-- ---------------------------------------------------------------------------
-- Returns events whose `synced_at >= since`. Events are mutated only by
-- the calendar sync function (writes touch every row in the rolling
-- window), so `synced_at` IS the high-watermark.
--
-- Pass `null` for `since` on first launch to receive a full snapshot.

create or replace function public.sync_events_since(since timestamptz)
returns table(
  id              uuid,
  google_event_id text,
  title           text,
  description     text,
  start_at        timestamptz,
  end_at          timestamptz,
  is_counted      boolean,
  synced_at       timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select e.id, e.google_event_id, e.title, e.description,
         e.start_at, e.end_at, e.is_counted, e.synced_at
    from public.events e
   where since is null or e.synced_at >= since
   order by e.synced_at asc;
$$;

revoke execute on function public.sync_events_since(timestamptz) from public;
grant execute on function public.sync_events_since(timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- sync_attendance_since(since timestamptz)
-- ---------------------------------------------------------------------------
-- Returns:
--   1. Live rows where `marked_at >= since` (new marks + re-marks).
--   2. Deletion tombstones from attendance_deletions where
--      `deleted_at >= since`. The client matches them by (event_id,
--      person_id) and removes the local row.
--
-- The shape is unified via a `kind` column ('upsert'|'delete') so the
-- caller can branch on it. Empty inputs yield zero rows.

create or replace function public.sync_attendance_since(since timestamptz)
returns table(
  kind        text,
  event_id    uuid,
  person_id   uuid,
  marked_by   uuid,
  marked_at   timestamptz,
  deleted_at  timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select 'upsert'::text as kind,
         a.event_id, a.person_id, a.marked_by, a.marked_at, null::timestamptz as deleted_at
    from public.attendance a
   where since is null or a.marked_at >= since
  union all
  select 'delete'::text as kind,
         d.event_id, d.person_id, null::uuid as marked_by, null::timestamptz as marked_at, d.deleted_at
    from public.attendance_deletions d
   where since is null or d.deleted_at >= since
   order by 5 nulls last, 6 nulls last;
$$;

revoke execute on function public.sync_attendance_since(timestamptz) from public;
grant execute on function public.sync_attendance_since(timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- sync_notifications_since(since timestamptz)
-- ---------------------------------------------------------------------------
-- Caller's own notifications updated on or after `since`. We treat
-- `read_at` as the "row updated" marker for read-state changes; new
-- inserts are picked up via `created_at`. The greater of the two is
-- used as the high-watermark when comparing to `since`.

create or replace function public.sync_notifications_since(since timestamptz)
returns table(
  id                    uuid,
  recipient_servant_id  uuid,
  type                  text,
  payload               jsonb,
  read_at               timestamptz,
  created_at            timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select n.id, n.recipient_servant_id, n.type, n.payload, n.read_at, n.created_at
    from public.notifications n
   where n.recipient_servant_id = auth.uid()
     and (since is null
          or n.created_at >= since
          or (n.read_at is not null and n.read_at >= since))
   order by greatest(n.created_at, coalesce(n.read_at, n.created_at)) asc;
$$;

revoke execute on function public.sync_notifications_since(timestamptz) from public;
grant execute on function public.sync_notifications_since(timestamptz) to authenticated;

-- The canonical column projection the mobile client mirrors locally
-- is documented in `src/services/db/migrations/001_initial.ts` and the
-- per-RPC return-table signatures above; no helper view is needed.
