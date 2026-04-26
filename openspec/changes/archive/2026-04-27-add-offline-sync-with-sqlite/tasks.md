# Tasks — add-offline-sync-with-sqlite

## 1. Server delta-sync RPCs

- [x] 1.1 `017_sync_rpcs.sql` (016 was taken by `016_attendance_rpcs.sql`):
  - `sync_persons_since(since timestamptz)` returns rows where `updated_at >= since` OR `deleted_at >= since`. Soft-delete is encoded via `deleted_at` flag (already exists).
  - `sync_events_since(since timestamptz)` returns events where `synced_at >= since` (events are mutated only by the sync function, so `synced_at` is the right marker).
  - `sync_attendance_since(since timestamptz)` returns rows where `marked_at >= since`. For deletions, uses an `attendance_deletions` tombstone table populated by an AFTER DELETE trigger.
  - `sync_notifications_since(since timestamptz)` for the inbox.
- [x] 1.2 The canonical column projection the client mirrors locally is documented inline in `017_sync_rpcs.sql` (per-RPC `returns table(...)` signatures) and in `src/services/db/migrations/001_initial.ts` — no helper view is needed.

## 2. expo-sqlite local schema + migrator

- [x] 2.1 `src/services/db/database.ts`: opens the SQLite DB with `SQLite.openDatabaseAsync('stmina.db')`.
- [x] 2.2 `src/services/db/migrator.ts`: reads `sync_meta.schema_version`, applies pending migrations.
- [x] 2.3 `src/services/db/migrations/001_initial.ts`: creates `persons`, `events`, `attendance`, `notifications`, `local_sync_queue`, `sync_meta` tables.

## 3. Repositories

- [x] 3.1 `src/services/db/repositories/personsRepo.ts`: `listPersons(filter)`, `getPerson(id)`, `upsertPersons(rows[])`, `softDeletePersons(ids[])`, `rewritePersonId`.
- [x] 3.2 `src/services/db/repositories/eventsRepo.ts`: `getTodayEvents()`, `getEvent(id)`, `upsertEvents(rows[])`.
- [x] 3.3 `src/services/db/repositories/attendanceRepo.ts`: `getEventAttendance(eventId)`, `markPresent`, `unmarkPresent`, `applyServerRows(rows[])`, `rewriteAttendancePersonId`.
- [x] 3.4 `src/services/db/repositories/notificationsRepo.ts`: `listNotifications`, `upsertNotifications`, `markRead`, `insertLocalSystemNotification`.
- [x] 3.5 `src/services/db/repositories/queueRepo.ts`: `enqueue`, `dequeue`, `peek`, `length`, `listAll`, `markAttempt`, `markNeedsAttention`, `clearQueue`, `rewriteTempId`, `BACKOFF_SCHEDULE_MS`.
- [x] 3.6 `src/services/db/repositories/syncMetaRepo.ts`: `getMeta` / `setMeta` key-value accessor for `last_pull_at` etc.

## 4. Sync engine

- [x] 4.1 `src/services/sync/SyncEngine.ts`:
  - `pull()` reads `sync_meta.last_pull_at`, calls each `*_since` RPC, applies via repos, advances `last_pull_at`.
  - `push()` peeks the queue, dispatches the op via the matching RPC, dequeues on success, backs off on failure.
  - `runOnce()` is push-then-pull (re-entrant guarded).
  - `start({ onAppForeground, onSignedIn })` subscribes to layout/auth signals and fires `runOnce`.
  - `useSyncState()` returns `{ status, queueLength, lastPullAt, lastError, hasCompletedFirstPull }`.
- [x] 4.2 Op handlers cover `mark_attendance`, `unmark_attendance`, `create_person` (with temp_id rewrite into persons/attendance/queue), `update_person`, `soft_delete_person`, `assign_person`, `mark_notification_read`.
- [x] 4.3 Backoff schedule lives in `queueRepo.BACKOFF_SCHEDULE_MS = [5_000, 15_000, 60_000, 300_000, 600_000]` and is applied by `markAttempt`.
- [x] 4.4 4xx (HTTP 4xx OR PostgREST `P0001` / `42501` / `23xxx`) marks op `needs_attention` and inserts a local `system` notification ("Your check-in could not be saved: [reason]") via `insertLocalSystemNotification`.

## 5. Service layer rewrites

- [x] 5.1 `src/services/api/persons.ts`: rewrite to read-from-local + enqueue-write. `createPerson` returns a `temp-…` id immediately; `findPotentialDuplicate` runs against the local cache.
- [x] 5.2 `src/services/api/attendance.ts`: roster reads from local; `markAttendance`/`unmarkAttendance` enqueue ops and apply locally; `isEventWithinEditWindow` is a Berlin-local pure computation.
- [x] 5.3 `src/services/api/events.ts`: `getTodayEvents` reads from local; admin counted-event RPCs unchanged.
- [x] 5.4 `src/services/api/notifications.ts`: local-first list + `markNotificationRead` enqueues.

## 6. UI integration

- [x] 6.1 `src/components/SyncStatusIndicator.tsx`: Messenger-style status bar — auto-hides when idle, amber while syncing/queued (`Syncing N changes…` with spinner OR `N changes waiting to sync` with alert icon), green "Synced" pulse for ~2s on busy → idle transition. Tap opens Paper Dialog with last-sync timestamp, queue length, "Sync now".
- [x] 6.2 `app/(app)/_layout.tsx`: bar lives in an absolute-positioned overlay (`pointerEvents="box-none"`) below the system status bar so it doesn't push the Stack down — keeps screen headers from double-padding.
- [x] 6.3 First-launch loading: centered `ActivityIndicator` + `sync.firstLaunchLoading` until `runOnce()` settles (success or failure — empty cache rendering takes over after offline first-launch).
- [x] 6.4 Pull-to-refresh wired on persons list (`app/(app)/persons/index.tsx`), today's events (`app/(app)/attendance/index.tsx`), and roster (`src/features/attendance/RosterScreen.tsx`). Each calls `getSyncEngine().runOnce()` then refetches the relevant queries.
- [x] 6.5 `src/services/sync/useSyncBootstrap.ts`: hook wires SyncEngine to AppState foreground + auth-state transitions; called from `app/(app)/_layout.tsx`.

## 7. Sign-out dialog

- [x] 7.1 `src/components/SignOutDialog.tsx` exposes `useSignOutWithGuard()` returning `{ request, Dialog }`. Home screen (`app/(app)/index.tsx`) calls `request()` from the menu and renders `<SignOutGuardDialog />`. When `queueRepo.length() > 0`, the Paper Dialog "Unsynced Changes" appears with "Stay logged in" (default) and "Logout anyway" (clears queue then signs out). When the queue is empty, sign-out runs immediately.

## 8. Conflict toast

- [x] 8.1 `SyncEngine.pull` runs `detectPersonConflicts` which compares incoming `updated_at` to the local cache for any person id referenced by a queued `update_person` / `soft_delete_person`. The most-recent conflict's name is parked on `useSyncState.conflictedPersonName`; `src/components/SyncConflictSnackbar.tsx` (mounted in `app/(app)/_layout.tsx`) renders the Paper Snackbar with `sync.conflictToast`. push runs first in `runOnce`, so by the time pull observes the server-newer row, the local change has already been dispatched (server-wins after one round-trip).

## 9. Translations

- [x] 9.1 `src/i18n/locales/{en,de,ar}.json`: added a `sync` namespace with `status.*`, `panel.*` (with i18next plurals), `firstLaunchLoading`, `signOutDialog.*`, `conflictToast`, and `errorToast.fourXX`.

## 10. Tests

- [x] 10.1 `tests/sync/queueRepo.test.ts` exercises enqueue → peek → dequeue ordering and `length`/`listAll` shapes against the in-memory `FakeQueueDb`.
- [x] 10.2 `tests/sync/queueRepo.test.ts` covers `rewriteTempId` (payload references rewritten + temp_id cleared); `tests/sync/syncEnginePush.test.ts` covers the engine-level rewrite (`create_person` → `update_person` references the real id).
- [x] 10.3 `tests/sync/backoff.test.ts` validates the 5/15/60/300/600 schedule and the cap.
- [x] 10.4 `tests/sync/syncEnginePull.test.ts` mocks Supabase + repos and verifies pull applies persons/events/attendance/notifications and bumps `last_pull_at`. `tests/sync/syncEnginePush.test.ts` covers push draining the queue.
- [x] 10.5 `tests/sync/syncEnginePush.test.ts` "drains ops in FIFO order" exercises the multi-op-in-order path.
- [x] 10.6 `tests/sync/syncEnginePush.test.ts` "marks 4xx ops as needs_attention" verifies `insertLocalSystemNotification` is called and the op is parked.
- [x] 10.7 `tests/sync/syncStatusIndicator.test.tsx` drives the indicator through idle / syncing / offline-error transitions.
- [x] 10.8 `tests/sync/signOutDialog.test.tsx` covers all three branches: empty queue → immediate sign-out; non-empty queue → dialog; "Logout anyway" → `clearQueue` then `signOut`.
- [x] 10.9 Replaced legacy RPC-direct unit tests (`tests/persons/personsService.test.ts`, `tests/attendance/attendanceService.test.ts`, `tests/calendar/eventsService.test.ts`) with local-first variants matching the new service-layer behaviour.

## 11. Verification

Static verification (run in this session):

- [x] 11.1 `openspec validate add-offline-sync-with-sqlite` passes.
- [x] 11.2 `npm run typecheck` passes (clean tsc --noEmit).
- [x] 11.3 `npm run lint` passes (eslint, 0 warnings).
- [x] 11.4 `npx jest` — 291 passing, 50 expected skips; new sync tests in `tests/sync/*` cover queue FIFO, temp_id rewrite, backoff, push, pull, 4xx, status indicator, sign-out dialog, kick/retry/reconnect.

Device verification (Expo Go):

- [x] 11.5 Cold app, online → first pull populates persons/events/attendance.
- [x] 11.6 Disable Wi-Fi → mark 5 persons in roster → save → Messenger-style status bar appears at the top in amber: "5 changes waiting to sync" → roster shows local check states.
- [x] 11.7 Re-enable Wi-Fi → bar transitions to "Syncing 5 changes…" (amber + spinner) → green "Synced" pulse for ~2s → bar auto-hides; queue length 0; rows visible in the server DB.
- [x] 11.8 Quick Add offline → temp_id person appears in list → online → push completes; person now has real id (verify).
- [x] 11.9 With 3 unsynced ops, sign out → "Unsynced changes" dialog appears with "Stay logged in" / "Logout anyway".
- [x] 11.10 Force a 4xx: edit window expired during queue drain → notification "Your check-in could not be saved" appears in inbox.
