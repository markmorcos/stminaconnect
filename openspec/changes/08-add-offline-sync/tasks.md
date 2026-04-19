## 1. Local DB

- [ ] 1.1 `services/db/schema.ts`: SQLite table definitions mirroring `persons`, `person_comments`, `events`, `attendance`, `counted_event_patterns`; plus `sync_outbox`, `schema_migrations`, `kv` (for last-pull timestamp)
- [ ] 1.2 Migration runner that applies pending SQLite migrations at app boot
- [ ] 1.3 Typed query helpers `services/db/queries.ts` (listPersons, getPerson, listEvents, listAttendanceForEvent, etc.)
- [ ] 1.4 Unit tests for each query helper against an in-memory SQLite

## 2. Server-side delta RPC

- [ ] 2.1 Migration `015_pull_changes_rpc.sql`: `pull_changes(since timestamptz) returns jsonb` with the changed rows from every synced table
- [ ] 2.2 Integration tests exercising RLS still applying on the RPC result

## 3. Sync engine

- [ ] 3.1 `services/sync/outbox.ts`: enqueue, dequeue, mark status; persistence via SQLite
- [ ] 3.2 `services/sync/id-map.ts`: map local UUIDs to server UUIDs after first successful sync
- [ ] 3.3 `services/sync/puller.ts`: fetch `pull_changes(since=last-pull)`, apply rows to local DB, update last-pull
- [ ] 3.4 `services/sync/pusher.ts`: drain outbox FIFO; for each kind, dispatch to the right API; on success, apply server response; on failure, exponential backoff
- [ ] 3.5 `services/sync/index.ts`: orchestrator triggered by NetInfo online, AppState foreground, 5-min interval, and manual pull-to-refresh
- [ ] 3.6 Unit tests: end-to-end with mock API — offline creates 3 persons + 5 attendances → sync → all land, outbox empty, id-map populated
- [ ] 3.7 Unit test for dependent-mutation replay: create_person locally → mark_attendance referencing local id → sync → both succeed with server ids

## 4. UI plumbing

- [ ] 4.1 `stores/sync.ts` (Zustand): state machine for sync status
- [ ] 4.2 `components/ui/sync-banner.tsx`: renders at top of `(tabs)` and other authenticated roots
- [ ] 4.3 Tap the banner when in error state to retry
- [ ] 4.4 Rewrite data hooks (`use-persons`, `use-events`, `use-attendance`, etc.) to read from local DB via TanStack Query; writes go through sync layer
- [ ] 4.5 Ensure optimistic UI still works (already was; now with local DB it's real)

## 5. Modified-spec behaviors

- [ ] 5.1 Quick Add screen: while offline, submitting enqueues; toast "Added (saved offline, will sync)"; Person detail immediately reflects the new row locally
- [ ] 5.2 Check-in roster: marks enqueue silently while offline; sync banner shows pending count
- [ ] 5.3 Full Registration upgrade: works offline against a Quick Add that is itself still pending — id-map resolves on sync
- [ ] 5.4 Comments: add while offline, visible locally, syncs later

## 6. Sync banner states

- [ ] 6.1 `Synced • N min ago` — green, subtle
- [ ] 6.2 `Syncing…` — amber with spinner
- [ ] 6.3 `Offline (N pending)` — gray with cloud-off icon
- [ ] 6.4 `Sync error — tap to retry` — red, tappable
- [ ] 6.5 Tests for banner state transitions

## 7. Verification

- [ ] 7.1 Manual: turn off connectivity; Quick Add 2 people; check 5 people in at today's event; add a comment; reconnect; verify all appear server-side within 30s
- [ ] 7.2 Manual: kill the app mid-sync (airplane mode → tap check-ins → force-close) → reopen → banner shows pending → reconnect → all sync
- [ ] 7.3 Manual: two devices online; one marks the same person twice in quick succession; confirm idempotency
- [ ] 7.4 `make test`, `make lint`, `make typecheck` pass
- [ ] 7.5 `openspec validate add-offline-sync` passes
- [ ] 7.6 Walk every scenario in `specs/offline-sync/spec.md` and the deltas
