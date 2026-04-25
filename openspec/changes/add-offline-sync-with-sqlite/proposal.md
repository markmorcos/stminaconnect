## Why

Servants check in members during services in basement halls with intermittent Wi-Fi. The app *must* function without connectivity: read the roster, toggle checks, save — all while offline — and seamlessly catch up when the network returns. This is the most architecturally consequential change in the project and it lands here, after the online flow is fully working, because we want to wrap the existing flow in a sync layer rather than redesign it.

## What Changes

- **ADDED** capability `offline-sync`.
- **ADDED** expo-sqlite local database with mirror tables for `persons`, `events`, `attendance`, plus a `local_sync_queue` table.
- **ADDED** Sync engine (`src/services/sync/SyncEngine.ts`):
  - **Pull**: on app open, on foreground, and on manual pull-to-refresh — fetches updated rows since last sync timestamp from Supabase RPCs.
  - **Push**: drains the queue (FIFO), applying ops via existing RPCs. On success, removes from queue. On failure, leaves and retries with exponential backoff.
  - **Conflict resolution**: per Open Question F1 — last-write-wins by `markedAt`/`updatedAt`. Attendance has natural commutative semantics (set add/remove); for `persons` updates, server timestamp wins.
- **ADDED** Sync status indicator: small ✓/⏳/✗ icon in the top app bar. Tapping shows a compact panel: last sync timestamp, queue length, "Sync now" button.
- **ADDED** Logout-with-pending-queue dialog (Open Question F2): "You have N unsynced changes. Logging out will discard them. [Stay] [Logout anyway]".
- **ADDED** Conflict toast: when a push results in a server-side overwrite of a local change, the user sees a Snackbar: "Your local change to [person/event] was overwritten by a newer version".
- **MODIFIED** `attendance` flow:
  - Roster now reads from local SQLite first, falls through to RPC on cache miss.
  - Save enqueues `mark_attendance` / `unmark_attendance` ops into `local_sync_queue` instead of calling RPCs synchronously. Local SQLite updated optimistically.
  - The roster's check states reflect local state instantly.
- **MODIFIED** `persons` flow:
  - List + profile read local first.
  - Edit and Quick Add enqueue `create_person` / `update_person` ops; local insert/update applied with a temp-uuid for new rows (replaced on push success).
- **MODIFIED** Sync schema and behavior wired into TanStack Query — local cache acts as the data layer.

## Impact

- **Affected specs**: `offline-sync` (new), `attendance` (modified — adds offline behavior), `person-management` (modified — adds offline behavior).
- **Affected code**: new `src/services/sync/*`, new `src/services/db/*` (expo-sqlite helpers), modified `src/services/api/{persons,attendance,events}.ts` (now go through sync engine), modified `app/(app)/_layout.tsx` (sync status indicator), modified Quick Add / Full Reg / Roster screens (consume local cache).
- **Breaking changes**: API call sites are now async-but-immediate (return optimistic results). Tests need to wait for queue drain before asserting server state.
- **Migration needs**: client-side schema migration system for SQLite (versioned table; introduce migration runner).
- **Expo Go compatible**: yes — expo-sqlite is bundled. No native modules.
- **Uses design system**: yes — the sync status indicator and any new screens use design-system tokens and components.
- **Dependencies**: `add-attendance-online-only`, `add-full-registration`, `add-google-calendar-sync`.
