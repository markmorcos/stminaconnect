# Tasks — add-offline-sync-with-sqlite

## 1. Server delta-sync RPCs

- [ ] 1.1 `016_sync_rpcs.sql`:
  - `sync_persons_since(since timestamptz)` returns rows where `updated_at >= since` OR `deleted_at >= since`. Soft-delete is encoded via `deleted_at` flag (already exists).
  - `sync_events_since(since timestamptz)` returns events where `synced_at >= since` (events are mutated only by the sync function, so `synced_at` is the right marker).
  - `sync_attendance_since(since timestamptz)` returns rows where `marked_at >= since`. For deletions, use a small `attendance_deletions` table populated by an `unmark_attendance` trigger.
- [ ] 1.2 `016_sync_rpcs.sql`: helper view exposes these as projections that match local schema 1:1.

## 2. expo-sqlite local schema + migrator

- [ ] 2.1 `src/services/db/database.ts`: opens the SQLite DB with `SQLite.openDatabaseAsync('stmina.db')`.
- [ ] 2.2 `src/services/db/migrator.ts`: reads `sync_meta.schema_version`, applies pending migrations.
- [ ] 2.3 `src/services/db/migrations/001_initial.ts`: creates `persons`, `events`, `attendance`, `notifications`, `local_sync_queue`, `sync_meta` tables.

## 3. Repositories

- [ ] 3.1 `src/services/db/repositories/personsRepo.ts`: `listPersons(filter)`, `getPerson(id)`, `upsertPersons(rows[])`, `softDeletePersons(ids[])`.
- [ ] 3.2 `src/services/db/repositories/eventsRepo.ts`: `getTodayEvents()`, `upsertEvents(rows[])`.
- [ ] 3.3 `src/services/db/repositories/attendanceRepo.ts`: `getEventAttendance(eventId)`, `markPresent(eventId, personIds)`, `unmarkPresent(eventId, personIds)`, `applyServerRows(rows[])`.
- [ ] 3.4 `src/services/db/repositories/notificationsRepo.ts`: list, mark read.
- [ ] 3.5 `src/services/db/repositories/queueRepo.ts`: `enqueue(op)`, `dequeue(id)`, `peek()`, `length()`, `markAttempt(id, error)`, `clearQueue()`.

## 4. Sync engine

- [ ] 4.1 `src/services/sync/SyncEngine.ts`:
  - `pull()`: reads `sync_meta.last_pull_at`, calls each `*_since` RPC, applies via repos, sets new `last_pull_at`.
  - `push()`: while queue non-empty, peek, dispatch op via the matching server RPC, on success dequeue; on failure backoff.
  - `runOnce()`: serial — push then pull.
  - `start()`: subscribes to auth state + foreground events; runs on app open + foreground.
  - State signal: `useSyncState()` returning `{ status: 'idle' | 'pulling' | 'pushing' | 'error', queueLength, lastPullAt, lastError }`.
- [ ] 4.2 Implement op handlers:
  - `mark_attendance` → calls `markAttendance` RPC.
  - `unmark_attendance` → calls `unmarkAttendance` RPC.
  - `create_person` → calls `createPerson` RPC; on success, rewrites temp_id → real id in local rows AND in any subsequent queue items referencing that temp_id.
  - `update_person`, `soft_delete_person`, `assign_person`, `mark_notification_read` → straightforward.
- [ ] 4.3 Backoff schedule: 5s, 15s, 60s, 300s, 600s (capped).
- [ ] 4.4 4xx errors mark op as `needs_attention`; emit a `system` notification: "Your change to X could not be saved: [reason]".

## 5. Service layer rewrites

- [ ] 5.1 `src/services/api/persons.ts`: rewrite to read-from-local + enqueue-write. `createPerson` returns a temp_id-wrapped Person immediately.
- [ ] 5.2 `src/services/api/attendance.ts`: roster reads from local; mark/unmark enqueue + update local.
- [ ] 5.3 `src/services/api/events.ts`: `getTodayEvents` reads from local (last pulled).
- [ ] 5.4 `src/services/api/notifications.ts`: similarly local-first.

## 6. UI integration

- [ ] 6.1 `src/components/SyncStatusIndicator.tsx`: ✓/⏳/✗ with tap → panel showing details and a "Sync now" button.
- [ ] 6.2 In `app/(app)/_layout.tsx`: render the indicator in the Stack header right.
- [ ] 6.3 First-launch loading UX: show centered ActivityIndicator + text "Syncing initial data…" until first pull completes.
- [ ] 6.4 Pull-to-refresh on persons list, events list, roster — invokes `SyncEngine.runOnce()`.

## 7. Sign-out dialog

- [ ] 7.1 In `authStore.signOut`: if `queueRepo.length() > 0`, show Paper Dialog "Unsynced Changes". Buttons: "Stay logged in" (default), "Logout anyway" (clears queue, signs out).

## 8. Conflict toast

- [ ] 8.1 During pull, if a row arrives with `updated_at > local.updated_at` AND a pending queue op for that id exists, after push completes show a Snackbar: "Your local change to X was overwritten by a newer version".

## 9. Translations

- [ ] 9.1 Extend locales under `sync.*`:
  - `status.idle`, `status.syncing`, `status.error`, `status.offline`.
  - `panel.lastSync`, `panel.queueLength`, `panel.syncNow`, `panel.unsynced`.
  - `firstLaunchLoading`.
  - `signOutDialog.title`, `signOutDialog.body`, `signOutDialog.stay`, `signOutDialog.logoutAnyway`.
  - `conflictToast`.
  - `errorToast.4xx` (parameterized).

## 10. Tests

- [ ] 10.1 Unit: queue enqueue → peek → dequeue ordering FIFO.
- [ ] 10.2 Unit: dependency rewrite when `create_person` resolves a temp_id (subsequent `update_person` references the new id).
- [ ] 10.3 Unit: backoff schedule.
- [ ] 10.4 Integration (mocked Supabase): pull applies inserts, updates, soft-deletes; push drains queue.
- [ ] 10.5 Integration: offline → enqueue 5 ops → online → all 5 dispatched in order.
- [ ] 10.6 Integration: 4xx response surfaces a `system` notification.
- [ ] 10.7 Component: status indicator transitions through states correctly.
- [ ] 10.8 Component: sign-out dialog appears when queue non-empty.

## 11. Verification (in Expo Go)

- [ ] 11.1 Cold app, online → first pull populates persons/events/attendance.
- [ ] 11.2 Disable Wi-Fi → mark 5 persons in roster → save → status shows ✗ (queue length 5) → roster shows local check states.
- [ ] 11.3 Re-enable Wi-Fi → status → ⏳ → ✓; queue length 0; verify rows in DB.
- [ ] 11.4 Quick Add offline → temp_id person appears in list → online → push completes; person now has real id (verify).
- [ ] 11.5 With 3 unsynced ops, sign out → dialog appears.
- [ ] 11.6 Force a 4xx: edit window expired during queue drain → notification "Your check-in could not be saved" appears in inbox.
- [ ] 11.7 `openspec validate add-offline-sync-with-sqlite` passes.
