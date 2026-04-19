## Why

Church basements have spotty cellular and no reliable WiFi. In the online-only version, check-in fails exactly when it's needed most. This change makes the app fully usable offline by persisting data locally (SQLite), queueing mutations, and syncing when connectivity returns. It also adds a visible sync status banner so servants always know what's happening with their data.

Offline support is in scope for check-in, quick add, full registration, comment add, reassign — every mutation shipped so far. Read flows work offline from the local cache.

## What Changes

- **ADDED** `offline-sync` capability:
  - Local SQLite schema mirroring relevant Supabase tables (`persons`, `person_comments`, `events`, `attendance`, `counted_event_patterns`).
  - `sync_outbox` table (local only) storing queued mutations with status (`pending | in_flight | failed | done`).
  - Pull-based hydration: on app start and on pull-to-refresh, fetch deltas via new `pull_changes(since timestamp)` RPC.
  - Push: `sync_outbox` drained whenever connectivity returns (NetInfo online event) or on app foreground.
  - Conflict resolution: last-write-wins by `marked_at` / `updated_at` captured client-side; `ON CONFLICT DO UPDATE` at server.
  - Sync status banner at top of every authenticated screen: `Synced • 2 min ago`, `Syncing…`, `Offline (3 pending)`, `Sync error — tap to retry`.
  - Existing screens switched to use TanStack Query hooks that transparently read from local DB, with writes going through the sync layer.
- **MODIFIED** `attendance`, `registration`, `person-management`: mutations now queue when offline instead of failing.

## Impact

- **Affected specs:** `offline-sync` (new), `attendance` (MODIFIED), `registration` (MODIFIED), `person-management` (MODIFIED)
- **Affected code (preview):**
  - Migration `015_pull_changes_rpc.sql` (server-side delta helper)
  - Mobile: `services/db/schema.ts`, `services/db/queries.ts`, `services/sync/outbox.ts`, `services/sync/puller.ts`, `services/sync/index.ts`, `components/ui/sync-banner.tsx`, `stores/sync.ts`
  - Rewrites of existing hooks to be cache-first
  - Tests: offline queue persistence across restarts, conflict resolution, banner state machine
- **Breaking changes:** none user-facing; internal refactor of data hooks.
- **Migration needs:** one server migration; local DB schema versioned internally.
- **Depends on:** `add-attendance-online`, `add-full-registration`, `add-google-calendar-sync`.
