# dev-tooling — Spec Delta

This delta is introduced by `add-absence-detection`. While verifying
the absence-detection flow on-device, we needed visibility into the
local SQLite mirror (to diagnose sync gaps, confirm row counts, etc.)
and a way to reset that mirror without reinstalling the app. Both are
now first-class dev affordances under `/dev/db`.

## ADDED Requirements

### Requirement: A read-only SQLite inspector SHALL be reachable from the home menu in dev / preview builds.

A `/dev/db` route MUST render the local SQLite mirror's structure and
contents:

- A list of every user table with column count and row count.
- The `sync_meta` key/value contents inline (`last_pull_at`,
  `schema_version`, future flags).
- A "Peek" affordance per table that opens a sheet showing column
  definitions (name, type, NOT NULL, PK) and the first 50 rows.
- A read-only SQL REPL accepting only `SELECT`, `PRAGMA`, or
  `WITH … SELECT` statements. Any other statement MUST be rejected at
  the input layer with a clear error message; the underlying call uses
  `getAllAsync` so write semantics are not exposed even if the regex
  is bypassed.

The route MUST be discoverable via the home overflow menu only when
`__DEV__` is true OR `EXPO_PUBLIC_SHOW_DEV_TOOLS=true`. End-user
production builds MUST NOT expose the entry point.

#### Scenario: Inspector lists tables with row counts

- **GIVEN** the local SQLite mirror has been populated by a prior sync
- **WHEN** an authenticated user opens `/dev/db`
- **THEN** the screen lists `persons`, `events`, `attendance`,
  `notifications`, `local_sync_queue`, `sync_meta` (and any future
  tables) with their row counts
- **AND** `sync_meta.last_pull_at` is rendered inline

#### Scenario: Read-only REPL rejects mutations

- **WHEN** the developer enters `DELETE FROM persons` and taps Run
- **THEN** the REPL surfaces "Only SELECT, PRAGMA, or WITH … SELECT
  statements are allowed."
- **AND** no rows are deleted

#### Scenario: Inspector hidden in production

- **GIVEN** a production-flavoured build with `__DEV__ === false` and
  `EXPO_PUBLIC_SHOW_DEV_TOOLS` unset
- **WHEN** the home overflow menu is opened
- **THEN** the "DB Inspector" entry is not rendered
- **AND** any direct navigation attempt to `/dev/db` resolves to a
  404-equivalent route fallback

### Requirement: A "Wipe local DB" action SHALL reset the mirror without invalidating auth.

The `/dev/db` screen MUST expose a destructive action that:

1. Closes the current SQLite connection and deletes the database file
   via `expo-sqlite`'s `deleteDatabaseAsync`.
2. Resets the cached database promise so the next access reopens with
   a fresh schema (migrations re-run on the empty file).
3. Resets in-memory mirrors that read from the gone DB:
   `useSyncState` returns to its initial values (`lastPullAt = null`,
   `hasCompletedFirstPull = false`, queue length 0,
   `conflictedPersonName = null`); `useNotificationsStore` empties.
4. Refreshes the inspector view so the new empty tables render.
5. Kicks `getSyncEngine().runOnce()` so a fresh pull starts and the
   mirror repopulates from the server.

The action MUST be guarded by a confirmation modal that explains what
gets deleted (local cache, sync watermark, queued ops, in-memory
notifications) and what is preserved (auth session, server data). The
modal MUST be undismissable while the wipe is in flight.

#### Scenario: Wipe resets cache + watermark and triggers re-pull

- **GIVEN** the local mirror contains rows and `last_pull_at` is set
- **WHEN** the developer confirms the wipe
- **THEN** the mirror tables are empty when the inspector refreshes
- **AND** `sync_meta.last_pull_at` is null
- **AND** `useSyncState.hasCompletedFirstPull` is false
- **AND** within a few seconds, the SyncEngine completes a fresh pull
  and the row counts return to non-zero (assuming the user is online)

#### Scenario: Wipe preserves auth

- **GIVEN** an authenticated session
- **WHEN** the developer wipes the local DB
- **THEN** the user is NOT signed out
- **AND** the home screen continues to render under the same servant
  identity

#### Scenario: Pending queue ops are intentionally dropped

- **GIVEN** the local sync queue has unpushed mutations
- **WHEN** the wipe runs
- **THEN** those ops are deleted with the rest of the file
- **AND** the confirmation modal copy explicitly warned the developer
  that pending queued ops will be lost
