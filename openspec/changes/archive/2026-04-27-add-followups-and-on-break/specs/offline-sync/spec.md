# offline-sync — Spec Delta

This delta is introduced by `add-followups-and-on-break`. While
verifying the change end-to-end, two gaps surfaced in how cached reads
react to fresh writes that land in SQLite:

- After a SyncEngine pull completes, screens that were already mounted
  kept showing their last-rendered cache because TanStack Query had no
  reason to re-read. The dev-mode "Wipe local DB" flow in particular
  would leave the attendance picker visibly empty until the user
  reloaded the app, even though the SyncEngine had already populated
  the new mirror in the background.
- The admin "Resync now" affordance triggers a server-side Edge Function
  via `trigger_calendar_sync`, which writes new rows into `events`. The
  mobile SyncEngine had no way to learn about those writes until its
  next AppState foreground event, so the attendance picker stayed
  stale.

## ADDED Requirements

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
