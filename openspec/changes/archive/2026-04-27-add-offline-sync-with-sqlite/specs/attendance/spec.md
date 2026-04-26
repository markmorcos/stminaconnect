# attendance — Spec Delta

## MODIFIED Requirements

### Requirement: Save SHALL batch all pending changes into one round-trip.

Tapping Save MUST persist pending check-in changes for the active event. From this change forward, Save MUST enqueue `mark_attendance` and `unmark_attendance` ops into `local_sync_queue` and update the local SQLite `attendance` cache optimistically — the actual RPC dispatch is owned by the SyncEngine. UI feedback ("Saved") MUST NOT depend on the network round-trip; the sync indicator reflects the queued state until the SyncEngine drains it.

#### Scenario: Save updates local immediately

- **GIVEN** the roster has pending toggles
- **WHEN** the user taps Save
- **THEN** the local `attendance` table is updated within the same UI frame
- **AND** the corresponding ops are added to `local_sync_queue`
- **AND** the Save FAB hides
- **AND** the indicator reflects pending sync

#### Scenario: Save offline still succeeds locally

- **GIVEN** the device is offline
- **AND** the roster has pending toggles
- **WHEN** the user taps Save
- **THEN** the local cache is updated
- **AND** ops are queued
- **AND** the user receives a localized "Saved" confirmation (no network error surfaced)
