## ADDED Requirements

### Requirement: Reads work offline from local cache

Every read flow (person lists, person detail, today's events, roster, attendance history, comments the user is authorized to see) SHALL render from the local SQLite cache and SHALL NOT require connectivity.

#### Scenario: Offline read

- **GIVEN** the app has previously synced
- **AND** the device is now offline
- **WHEN** the servant opens the Check In tab
- **THEN** today's events render from the local cache
- **AND** tapping an event shows the roster with locally-cached marked/unmarked state

#### Scenario: Person detail offline

- **GIVEN** offline
- **WHEN** a servant opens a person they are assigned to
- **THEN** Info, Attendance history, and Comments all render from local cache
- **AND** comments unauthorized for the user remain hidden consistently with online behavior

### Requirement: Mutations queue while offline

When offline, all mutations (mark/unmark attendance, create person, update person, add/delete comment, reassign) SHALL be written optimistically to the local DB and enqueued into `sync_outbox`. The UI SHALL reflect the mutation immediately.

#### Scenario: Offline quick add

- **GIVEN** the device is offline
- **WHEN** the servant fills Quick Add and taps Save
- **THEN** a new row appears in local `persons` with a local UUID
- **AND** a matching entry appears in `sync_outbox` with `status = pending`
- **AND** the Person is visible in lists and detail immediately

#### Scenario: Offline check-in

- **GIVEN** offline
- **WHEN** the servant taps 5 rows in a roster
- **THEN** 5 entries appear in `sync_outbox`
- **AND** the roster shows all 5 as marked

### Requirement: Queue drains on reconnect

When connectivity returns, the sync engine SHALL drain `sync_outbox` in FIFO order, mapping local UUIDs to server UUIDs and rewriting any dependent queued mutations before dispatch.

#### Scenario: Reconnect drains all

- **GIVEN** 3 creates and 5 mark_attendances are queued
- **WHEN** connectivity returns
- **THEN** the sync engine dispatches the 3 creates first
- **AND** receives server UUIDs in response
- **AND** rewrites the 5 mark_attendances to reference server UUIDs where necessary
- **AND** dispatches the 5 marks
- **AND** all 8 outbox entries transition to `done`

#### Scenario: Dependent rewrite

- **GIVEN** an offline Quick Add for Maria created locally as id `local-A`
- **AND** an offline mark_attendance referencing `local-A`
- **WHEN** reconnect occurs
- **THEN** the create_person succeeds and returns server id `server-A`
- **AND** the id-map records `local-A → server-A`
- **AND** the mark_attendance's payload is rewritten to reference `server-A` before dispatch
- **AND** the mark succeeds

### Requirement: Persistent outbox across restarts

`sync_outbox` SHALL persist across app restarts. A force-quit mid-sync SHALL not lose queued mutations; incomplete mutations resume on next sync attempt.

#### Scenario: Force-quit survives

- **GIVEN** 5 offline mutations are queued
- **WHEN** the user force-quits the app
- **AND** reopens it online later
- **THEN** all 5 mutations eventually sync successfully
- **AND** none are duplicated

### Requirement: Last-write-wins conflict resolution

On conflicting concurrent writes to the same (person, event) attendance or the same updatable `persons` row, the server SHALL keep the record with the later `marked_at` / `updated_at` timestamp captured at the client. Both clients SHALL receive a success response.

#### Scenario: Two servants mark same person

- **GIVEN** servant A and servant B are online on separate devices
- **WHEN** they each mark Maria for the same event within 1 second
- **THEN** one attendance row exists for (Maria, event)
- **AND** its `marked_by` is whichever write committed with the later `marked_at`
- **AND** both devices' UI show the row as marked (attributed to whichever they see)

#### Scenario: Offline edit overwritten by newer online edit

- **GIVEN** servant A edits Maria's region offline at 10:00 Berlin
- **AND** servant B (an admin) edits Maria's region online at 10:30 Berlin
- **WHEN** servant A's device syncs later
- **THEN** the server keeps servant B's value (later `updated_at`)
- **AND** A's device refetches and shows B's value on next pull

### Requirement: Sync status banner

Every authenticated screen SHALL show a sync status banner reflecting one of: `synced-recent`, `syncing`, `offline-pending`, `error`. Tapping the banner when in `error` SHALL retry sync.

#### Scenario: Offline with pending

- **GIVEN** 3 mutations are queued and the device is offline
- **WHEN** the user looks at any authenticated screen
- **THEN** the banner reads "Offline — 3 pending"
- **AND** shows a cloud-off icon

#### Scenario: Syncing indicator

- **WHEN** the sync engine is actively dispatching
- **THEN** the banner reads "Syncing…" with a spinner

#### Scenario: Recent-sync indicator

- **GIVEN** the last sync completed 90 seconds ago with no pending items
- **WHEN** the user looks at the banner
- **THEN** it reads "Synced • 2 min ago" (localized)

#### Scenario: Error retry

- **GIVEN** the sync engine fails with a network error repeatedly
- **AND** the banner shows "Sync error — tap to retry"
- **WHEN** the user taps the banner
- **THEN** the sync engine immediately retries
- **AND** the banner transitions to "Syncing…"

### Requirement: Pull-based delta sync

A `pull_changes(since)` RPC SHALL return rows changed since the provided timestamp across synced tables, respecting RLS. The client SHALL call this on app start, on pull-to-refresh, and on a background timer (every 5 minutes while active).

#### Scenario: Initial pull hydrates local DB

- **GIVEN** a fresh install; user signs in for the first time
- **WHEN** the sync engine runs
- **THEN** `pull_changes(since = epoch)` returns all authorized rows
- **AND** they are inserted into local DB
- **AND** the last-pull timestamp is saved

#### Scenario: Incremental pull

- **GIVEN** last-pull was 10 minutes ago
- **WHEN** the sync engine runs again
- **THEN** only rows changed in the last 10 minutes are returned and applied
- **AND** the last-pull timestamp is advanced

### Requirement: Single-user-per-device model

Signing in with a different user on the same device SHALL clear all local DB state and the outbox before hydrating the new user.

#### Scenario: User switch clears state

- **GIVEN** servant A is signed in with local data on a device
- **WHEN** A signs out and B signs in
- **THEN** all local tables are wiped
- **AND** B's initial pull hydrates from scratch
- **AND** A's outbox entries are discarded (they should already be synced or A would be warned before sign-out if pending exists)

### Requirement: Sign-out guard with pending mutations

If `sync_outbox` contains pending mutations when the user taps Sign Out, the app SHALL warn: "You have N pending changes that haven't synced. Sign out anyway? Those changes will be lost." Signing out after confirmation SHALL discard the outbox.

#### Scenario: Warned sign-out

- **GIVEN** 2 pending mutations in the outbox
- **WHEN** the user taps Sign Out
- **THEN** a confirm dialog appears mentioning the 2 pending changes
- **AND** "Cancel" aborts sign-out; "Sign out anyway" proceeds and wipes state
