## MODIFIED Requirements

### Requirement: Mutations queue while offline

Follow-up creation, snooze, completion, and on-break toggles SHALL be supported mutation kinds in `sync_outbox`, enqueued when offline and dispatched on reconnect.

#### Scenario: Offline follow-up

- **GIVEN** the device is offline
- **WHEN** the servant logs a Called follow-up
- **THEN** the alert resolves locally
- **AND** a `sync_outbox` entry is enqueued
- **AND** on reconnect the server reflects the resolution
- **AND** the push for this now-resolved alert that was already dispatched at trigger time is not re-dispatched on sync

#### Scenario: Offline on-break

- **GIVEN** offline; servant is assigned to Maria
- **WHEN** they mark Maria on break
- **THEN** the local `persons.on_break` updates
- **AND** the outbox queues the server update
- **AND** absence detection (server-side) respects the break once sync completes
