## MODIFIED Requirements

### Requirement: Offline tap shows a failure

(This requirement is REMOVED via the modification below.)

### Requirement: Mark attendance is optimistic

Tapping a roster row SHALL flip it to "marked" immediately (optimistic UI). When online, the mark SHALL be dispatched immediately; when offline, it SHALL be enqueued in `sync_outbox` and dispatched on reconnect. On server failure during dispatch, the UI SHALL reflect the revert once the sync engine reports failure.

#### Scenario: Happy path (online)

- **GIVEN** Maria is unmarked for today's event; device online
- **WHEN** the servant taps her row
- **THEN** the row flips to marked with a spinner → checkmark
- **AND** an `attendance` row is persisted server-side

#### Scenario: Offline check-in queues

- **GIVEN** the device is offline
- **WHEN** the servant taps Maria's row
- **THEN** the row flips to marked with a small "cloud-pending" badge
- **AND** a `sync_outbox` entry is created
- **AND** no toast error is shown (offline is expected, not an error)

#### Scenario: Sync replay succeeds

- **GIVEN** 5 attendance marks are queued offline
- **WHEN** connectivity returns and the sync engine drains the outbox
- **THEN** all 5 `attendance` rows are persisted server-side
- **AND** the cloud-pending badges disappear from the roster rows

#### Scenario: Sync replay partial failure

- **GIVEN** a queued mark for a person who has been archived server-side
- **WHEN** the sync engine attempts it
- **THEN** the mark fails with a server error
- **AND** the roster row reverts
- **AND** a toast reports "Could not save attendance for [name]: person no longer exists."

## REMOVED Requirements

### Requirement: Offline tap shows a failure

**Reason:** Offline support is now fully implemented. The previous requirement in `add-attendance-online` that offline taps fail with a toast is superseded by queued-write behavior.
