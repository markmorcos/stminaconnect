## Context

The single most important architectural change in v1. Sunday-morning connectivity is unreliable. We chose **expo-sqlite** (bundled with Expo, works in Expo Go) over WatermelonDB (native module, requires dev build). This gives us SQL-like ergonomics, the same query model server and client, and a familiar mental model for ops.

The conceptual model:
- **Server is authoritative**. Local DB is a cache + a queue.
- **Reads** come from local; UI never blocks on network.
- **Writes** go to a `local_sync_queue` and to the local cache simultaneously.
- **Sync engine** drains the queue + pulls server updates.

## Goals

- Servants can complete the entire check-in flow offline.
- App boot in Expo Go is fast (no waiting for network on cold start once data has been pulled at least once).
- The user always knows sync state.
- Conflicts are detected, surfaced, and resolved deterministically.

## Non-Goals

- Multi-device merge for the same servant. v1 assumes one device per servant.
- Per-field merge for `persons` updates. Whole-row last-write-wins.
- Deltas / partial sync. We pull whole-row snapshots within the rolling window.
- Background sync (silent push when app is closed). Phase 17 problem.
- Encryption-at-rest for the SQLite file. Phase 15 hardening.

## Decisions

1. **Local schema**:
   ```
   persons (mirrors server columns + sync_status text default 'synced')
   events (mirrors server columns + sync_status)
   attendance (mirrors server columns + sync_status)
   notifications (mirrors server columns)
   local_sync_queue (
     id integer primary key autoincrement,
     op_type text not null,            -- 'mark_attendance' | 'unmark_attendance' | 'create_person' | 'update_person' | 'soft_delete_person' | 'assign_person' | 'mark_notification_read'
     payload text not null,            -- JSON
     created_at integer not null,      -- epoch ms
     attempts integer default 0,
     last_error text,
     temp_id text                      -- for create_person; the local uuid used until server returns the real one
   )
   sync_meta (key text primary key, value text)  -- last_pull_at, schema_version, etc.
   ```
2. **Schema migration runner**: a tiny in-house migrator. On boot, reads `sync_meta.schema_version`, applies missing migrations from `src/services/db/migrations/`, sets the new version. Migrations are SQL strings.
3. **Op semantics**:
   - `mark_attendance`: idempotent server-side; client-side, also idempotent (upsert into local). If queued multiple times for the same `(event, person)`, queue dedupes on enqueue.
   - `unmark_attendance`: idempotent.
   - `create_person`: needs a `temp_id` (UUIDv4 generated locally). Local insert uses temp_id; on push success, server returns real id, local row is reidentified, and `assigned_servant`/`registered_by` references in queued ops are rewritten.
   - `update_person`: must wait for any earlier `create_person` for the same `temp_id` to complete (queue maintains FIFO + dependency tracking via `temp_id`).
   - `soft_delete_person`, `assign_person`, `mark_notification_read`: no special handling.
4. **Pull strategy** (resolves the read-path question):
   - On boot or foreground: `sync_persons_since(last_pull_at)`, `sync_events_since(last_pull_at)`, `sync_attendance_since(last_pull_at)`. Each RPC returns rows where `updated_at >= last_pull_at` plus deletions (a small `deletions` table on server, or each table includes a `deleted_at` for soft delete).
   - First pull: full snapshot.
   - Pull is non-blocking: UI renders from local cache while pull is in-flight.
5. **Push strategy**:
   - Drain queue oldest-first.
   - For each op, call the corresponding RPC. On success, dequeue. On failure (network), backoff and retry: 5s, 15s, 60s, 300s, capped at 600s.
   - If a 4xx (e.g. validation, edit-window-closed) occurs, mark the op `last_error` and surface a notification: "Your check-in for [event] could not be saved: [reason]". The op stays in the queue with a "needs attention" flag (admins/users can manually retry or discard via a small "Sync issues" screen — phase 15 introduces UI; for now, surface in console + notifications inbox).
6. **Conflict resolution** (resolves Open Question F1):
   - **Attendance**: rows are commutative — `mark` and `unmark` are idempotent; the union of operations from multiple devices yields the right state. No conflict possible.
   - **Persons updates**: server `updated_at` is the canonical version. When pulling, if local has a newer `updatedAt` AND a queued `update_person` for that id, push first, then pull again. If conflict still detected (rare race), the *server* version wins; show a Snackbar to the user.
7. **Logout with pending queue** (Open Question F2): if `local_sync_queue.length > 0`, `signOut` shows a Paper Dialog. Default action is "Stay logged in". "Logout anyway" clears the queue + sign-out.
8. **Indicator UX**: green ✓ when queue empty + last pull <5min; ⏳ amber when queue draining or pull in progress; ✗ red when offline + queue non-empty. Tap → expanded panel with details + "Sync now".
9. **Connectivity detection**: rely on RPC failure (offline = no response). No explicit `NetInfo` polling — keeps it simple.
10. **Pull frequency**: on app open, on foreground transition, on pull-to-refresh, after every successful push (to ensure the local cache reflects server-side changes immediately).
11. **First-launch UX**: cold app on first install needs an initial pull — show a centered Paper `ActivityIndicator` with text "Syncing initial data…" until the first pull completes. Only blocks on first launch.
12. **Notifications inbox**: also moves to local cache. Realtime subscription remains as before; on event, server inserts; pull picks it up and updates local. Read state similarly queued.
13. **Storage size estimate**: <200 persons, ~3 events/week × 6 months window after release ≈ 75 events, ≈ 200 × 75 × 0.3 fill rate ≈ 4500 attendance rows, ≈ 500KB. Negligible.

14. **Edit-window enforcement is server-side, not client-side** (re-asserts `add-attendance-online-only` decision § 3): the `mark_attendance` / `unmark_attendance` RPCs verify `now() < event.start_at + interval '1 day' + interval '3 hours' AT TIME ZONE 'Europe/Berlin'` and reject mutations past the window. Offline-queued ops that drain after the cutoff produce a 4xx response → marked `needs_attention` and surfaced via `system` notification. The local cache does not predict cutoff state; it always submits and accepts the server's verdict. `CHURCH_TIMEZONE = 'Europe/Berlin'` is the single canonical constant.

## Risks / Trade-offs

- **Risk**: temp_id rewrites are tricky if a queued op references a not-yet-created person. Mitigation: ordered queue + dependency check by `temp_id` (an op for a temp_id waits for the create op to dequeue first).
- **Risk**: pull races with push. Mitigation: pulls are read-only on local; pushes write. We serialize: complete pull before pushing, and complete push before pulling (single-threaded queue runner).
- **Risk**: SQLite migration bugs lock users out of their data. Mitigation: migrations are tiny, tested unit + integration; on hard failure, the local DB can be wiped and re-pulled.
- **Trade-off**: not using `expo-sqlite` async API everywhere — we wrap it in a tiny Promise interface and use `runInTransaction`. Acceptable verbosity.
- **Risk**: large pulls on first launch over slow network. Mitigation: window is small (<200 persons + ~75 events + ~4500 attendance ≈ 500KB JSON).
- **Trade-off**: not implementing background sync. Documented and accepted; phase 17 problem.

## Migration Plan

- Server-side: small additions to several RPCs to support `*_since` semantics. Migration `016_sync_rpcs.sql`.
- Client-side: `src/services/db/migrations/001_initial.sql.ts` runs on first boot.
- Phase 11 will add `attendance_marked_at` index server-side if not already present.

## Open Questions

- **F1, F2** resolved.
