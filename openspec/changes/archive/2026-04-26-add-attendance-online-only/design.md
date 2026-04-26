## Context

Check-in is the single highest-throughput flow on Sunday mornings — a servant marks 20-50 people in 5 minutes. UX is the critical path: large tap targets, no double-tap penalties, search-as-you-type. By shipping online-only first, we can validate the UX without entangling it with sync queue mechanics.

## Goals

- ≤ 2 taps from home to roster.
- "My Group" (assigned persons) auto-loaded; servant can mark assigned persons in <1 second each.
- "Find someone else" lets a servant mark any member, not just their assigned.
- Save is batched — one RPC call per save action — for efficiency and clean transactional semantics.
- Editable until end of day (per Open Question C1).
- Failure mode is honest: if the network drops, the user sees an error and can retry.

## Non-Goals

- Offline support. Phase 10.
- Bulk paste / CSV import. Out of v1.
- Per-attendance notes (e.g. "arrived late"). Out of v1.
- Marking _absence_ explicitly. Per Open Question C2, absence is implicit.
- Statistics/dashboards. Phase 13/14.

## Decisions

1. **Attendance schema**:
   ```
   id          uuid pk default gen_random_uuid()
   event_id    uuid not null references events(id) on delete cascade
   person_id   uuid not null references persons(id)
   marked_by   uuid not null references servants(id)
   marked_at   timestamptz not null default now()
   is_present  boolean not null default true
   unique (event_id, person_id)
   ```
   `is_present` exists for future flexibility (e.g. an explicit "did not attend" record) but in v1 we never insert `false`.
2. **Implicit absence**: `mark_attendance` upserts; `unmark_attendance` deletes. The set of present persons is the rows; everyone else is absent. This matches the servant mental model — they check people _in_, never _out_.
3. **Edit window** (Open Question C1): `mark_attendance` and `unmark_attendance` MUST verify `now() < event.start_at::date + interval '1 day' + interval '3 hours' AT TIME ZONE 'Europe/Berlin'`. Past the window, the RPCs return an error.
4. **My Group section**: `get_event_attendance(event_id)` is fetched in parallel with the servant's assigned persons (`list_persons` filtered by `assigned_servant=auth.uid()`). The roster renders all assigned persons with check states from the attendance set.
5. **"Find someone else" search**: `search_persons(query text)` returns a small projection (id, first_name, last_name, region) for any signed-in servant. Limit 25 per call. Debounced 300ms client-side.
6. **Save behaviour**: roster tracks pending changes locally (added/removed). Tapping Save sends two RPC calls — `mark_attendance` for adds and `unmark_attendance` for removes — wrapped in a `Promise.all`. On any failure, the local pending state is restored and an error Snackbar appears.
7. **Toggle UX**: tapping a row toggles its check immediately. Save is required to persist. A Save button (Paper FAB) shows the pending count: "Save (3 changes)". Without changes, the button is hidden.
8. **Roster ordering**: My Group first, alphabetical by last name. Search results appear in a separate section below My Group.
9. **Edit-mode banner**: when an event's window has closed, the roster opens in read-only mode with a banner: "This event is no longer editable" + the cutoff time.
10. **Concurrent editing**: two servants editing the same roster — last write wins per (event, person) pair via the unique constraint and upsert-on-conflict semantics. Phase 10 documents the read-then-write race more rigorously.

## Risks / Trade-offs

- **Risk**: a servant taps Save while offline → loss of pending state. Mitigation: keep the pending state in local component state until success; explicit failure mode tells the servant to wait. Phase 10 fully solves this with the offline queue.
- **Risk**: edit window confuses servants in different timezones (e.g. travelling). Mitigation: the cutoff is always shown in Europe/Berlin time on the banner.
- **Trade-off**: not modelling explicit absences in v1 means we can't distinguish "did not attend" from "we don't know if they attended". Acceptable for absence-streak math; future phase can extend.

## Migration Plan

- Two migrations.
- No data migration.

## Open Questions

- **C1, C2, C3** resolved.
