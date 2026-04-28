# offline-sync Specification

## Purpose

Defines the offline-first data layer that turns the app's reads and writes into local-SQLite-mediated operations. From this capability forward, screens never await an RPC for a read: the local cache is authoritative for rendering, while a SyncEngine drains a `local_sync_queue` of pending writes and pulls incremental server changes in the background. This makes core servant flows (persons, attendance, notifications) work offline and on flaky networks, while preserving the existing RPC surface as the canonical write target. A persistent sync indicator, conflict surfacing, and a sign-out guard for unsynced work make the queued state legible to the user.

## Requirements

### Requirement: All reads SHALL come from the local SQLite cache.

After this change, the persons list, person profile, today's events, roster, and notifications inbox screens MUST read from local SQLite tables. Network calls happen only via the SyncEngine; UI screens never await an RPC for a read.

#### Scenario: Persons list renders without network

- **GIVEN** the local cache contains 20 persons
- **AND** the device is in airplane mode
- **WHEN** the user opens the persons list
- **THEN** the list renders all 20 persons
- **AND** no network request is dispatched for the read

### Requirement: All writes SHALL be enqueued into `local_sync_queue` and reflected locally immediately.

A write operation (Quick Add, edit, mark attendance, etc.) MUST insert into `local_sync_queue` and update the local table optimistically. The UI MUST reflect the change without waiting for the server. The SyncEngine drains the queue asynchronously.

#### Scenario: Offline mark attendance reflects locally

- **GIVEN** offline state, an open roster
- **WHEN** the servant taps a person and Save
- **THEN** the person's check state shows as marked in the roster
- **AND** an op of type `mark_attendance` is added to `local_sync_queue`
- **AND** the local `attendance` table contains a row with `sync_status='pending'`

#### Scenario: Offline Quick Add appears in list

- **GIVEN** offline state
- **WHEN** the servant submits a Quick Add for "Mariam Saad"
- **THEN** Mariam appears in the persons list with a temp_id
- **AND** a `create_person` op is in the queue with `temp_id` matching the local row

### Requirement: The SyncEngine SHALL drain the queue serially with exponential backoff.

`push()` MUST process ops oldest-first. On success, the op is dequeued. On network failure, the op stays at the head and the engine waits per the backoff schedule (5s, 15s, 60s, 300s, 600s) before retrying.

#### Scenario: Network restored drains pending queue

- **GIVEN** 5 ops in the queue and offline state
- **WHEN** the network returns
- **THEN** the engine dispatches the ops in FIFO order
- **AND** each successful op is removed from the queue
- **AND** the queue length reaches 0

#### Scenario: Backoff between failed attempts

- **GIVEN** a queued op and the network is failing
- **WHEN** the engine attempts and fails
- **THEN** the next retry happens after 5 seconds
- **AND** a subsequent failure pushes the next retry to 15 seconds

### Requirement: Temp IDs SHALL be rewritten to server IDs after `create_person` succeeds.

When a `create_person` op completes, the SyncEngine MUST replace the temp_id in the local `persons` row with the server-assigned UUID and rewrite any later queued ops that reference the temp_id (e.g. `update_person`, `mark_attendance` with the temp person id) to use the real id.

#### Scenario: Subsequent update applies to created person

- **GIVEN** an offline `create_person` for temp_id `T1` followed by an `update_person` referencing `T1`
- **WHEN** the network returns
- **THEN** `create_person` succeeds and yields server id `S1`
- **AND** the queued `update_person` is rewritten to reference `S1` before being dispatched
- **AND** `update_person` succeeds against `S1`

### Requirement: The pull SHALL fetch only changes since the last successful pull.

`SyncEngine.pull()` MUST call `sync_persons_since`, `sync_events_since`, `sync_attendance_since`, and the notifications equivalent with the timestamp stored at `sync_meta.last_pull_at`. After a successful pull, the engine writes the new high-watermark.

#### Scenario: Subsequent pull is incremental

- **GIVEN** `last_pull_at` is set to a recent timestamp
- **WHEN** `pull()` runs
- **THEN** the RPCs are called with that timestamp as the `since` argument
- **AND** only rows updated/created/deleted since are applied to local

#### Scenario: First-launch full pull

- **GIVEN** `last_pull_at` is null
- **WHEN** `pull()` runs
- **THEN** the RPCs are called with epoch zero
- **AND** all in-window rows are applied to local

### Requirement: A sync status indicator SHALL be visible at all times within the authenticated app.

The Stack header in `app/(app)/_layout.tsx` MUST include a status icon: green check (idle, queue empty, last pull <5min), amber hourglass (pulling/pushing in progress), red cross (queue non-empty AND offline OR queue has needs-attention items). Tapping the icon opens a panel.

#### Scenario: Indicator transitions on offline write

- **GIVEN** indicator is green
- **WHEN** the device goes offline AND a write is enqueued
- **THEN** the indicator turns red
- **AND** the panel shows queue length 1

#### Scenario: Indicator returns to green after sync

- **GIVEN** indicator is red with queue length 5 (offline)
- **WHEN** the network returns and the queue drains successfully
- **THEN** the indicator turns green
- **AND** queue length is 0

### Requirement: Sign-out SHALL prompt when the queue is non-empty.

When `signOut` is invoked and `queueRepo.length() > 0`, the system MUST display a Paper Dialog warning that signing out will discard pending changes. The default action is "Stay logged in"; "Logout anyway" clears the queue and signs out.

#### Scenario: Sign-out blocked with pending writes

- **GIVEN** 3 ops in the queue
- **WHEN** the user taps "Sign out"
- **THEN** a dialog appears titled "Unsynced Changes" with body identifying 3 changes
- **AND** the default button focus is "Stay logged in"

#### Scenario: Logout anyway clears the queue

- **GIVEN** the dialog is open
- **WHEN** the user taps "Logout anyway"
- **THEN** the queue is emptied
- **AND** the user is signed out
- **AND** the next time they sign back in, the queue is empty

### Requirement: Conflicts SHALL be surfaced to the user.

When a pull observes a server row whose `updated_at` is newer than a local row that has a pending queued change for the same id, the SyncEngine MUST first push the pending op, then re-pull. If the server still wins after that round-trip, the engine MUST show a Snackbar: "Your local change to [name] was overwritten by a newer version."

#### Scenario: Concurrent persons edit, server wins

- **GIVEN** servant A edits person P offline (queued)
- **AND** admin B has separately edited P online with a more recent `updated_at`
- **WHEN** A goes online and the engine runs
- **THEN** A's update is pushed first
- **AND** the next pull yields B's version which is newer than A's just-pushed version
- **AND** local row reflects B's values
- **AND** Snackbar appears notifying A of the overwrite

### Requirement: 4xx errors during push SHALL be surfaced via the notifications inbox.

If an op fails with a 4xx (validation, edit-window-closed, RLS denial), the SyncEngine MUST stop retrying that op and dispatch a `system` notification to the user with a localized explanation. The op is marked `needs_attention` in the queue. (UI to discard or retry from a Sync Issues screen lands in phase 15.)

#### Scenario: Edit-window-closed surfaces in inbox

- **GIVEN** a `mark_attendance` op queued offline at 02:00 Berlin
- **AND** the network returns at 03:30 Berlin (past the cutoff)
- **WHEN** the engine pushes the op
- **THEN** the RPC returns a 4xx
- **AND** a `system` notification appears in the inbox: "Your check-in for Sunday Liturgy could not be saved: edit window closed"
- **AND** the op is marked `needs_attention`

### Requirement: Cached reads SHALL invalidate when the SyncEngine completes a pull.

A subscription to `useSyncState.lastPullAt` MUST call
`queryClient.invalidateQueries()` whenever the watermark advances, so
every TanStack Query that reads from the SQLite mirror re-fetches and
the UI reflects the freshly-pulled rows without the user reloading the
app. The hook MUST NOT fire on the first render so app boot does not
double-fetch (`hasCompletedFirstPull` already gates that path).

#### Scenario: Wipe + auto re-pull refreshes the picker

- **GIVEN** the attendance picker is mounted and showing the previous
  mirror's events
- **AND** the dev-only "Wipe local DB" action runs (clears SQLite,
  resets `useSyncState`, kicks the SyncEngine)
- **WHEN** the SyncEngine's pull completes and advances `lastPullAt`
- **THEN** the picker re-renders with the freshly-pulled events
- **AND** no app reload was required

#### Scenario: Background pull mid-session refreshes the persons list

- **GIVEN** the persons list is mounted
- **WHEN** an AppState foreground transition triggers `runOnce`
- **AND** `sync_persons_since` returns one new person
- **THEN** the persons list re-fetches from the local mirror and shows
  the new row within one render cycle of the pull completing

### Requirement: The admin "Resync now" affordance SHALL drive the local mirror to converge.

Tapping "Resync now" on the admin counted-events screen MUST, in
addition to refreshing the screen's own status row, kick the local
SyncEngine (`getSyncEngine().runOnce({ pull: true })`) shortly after
the server-side Edge Function would have committed its writes — so the
new events flow into the local mirror without requiring the user to
foreground/reload the app.

#### Scenario: Resync surfaces new events in the picker

- **GIVEN** the admin signs in and `events` is empty client-side
- **WHEN** the admin taps "Resync now" on `/admin/counted-events`
- **AND** the Edge Function writes new rows into `events`
- **THEN** within a few seconds the local SyncEngine has pulled the new
  rows
- **AND** the attendance picker, when next opened (or while open), shows
  the new events without an app reload

### Requirement: A "Sync Issues" screen SHALL expose `needs_attention` queue items.

`app/(app)/sync-issues.tsx` MUST list `local_sync_queue` rows with `needs_attention=true`, showing op type, target display name (e.g. person or event), `last_error`, and `created_at`. Each row MUST have a "Discard" action that removes the row from the queue. The screen MUST be reachable from the sync status panel.

#### Scenario: Discard removes the row

- **GIVEN** a needs-attention row in the queue
- **WHEN** the user taps Discard
- **THEN** the row is deleted from `local_sync_queue`
- **AND** the row no longer appears on the screen

#### Scenario: Screen reachable from status panel

- **GIVEN** the user opens the sync status indicator panel
- **WHEN** at least one queue item is `needs_attention`
- **THEN** a link "Sync Issues" is visible
- **AND** tapping it navigates to `/sync-issues`
