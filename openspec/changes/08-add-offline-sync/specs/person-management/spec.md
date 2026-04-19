## MODIFIED Requirements

### Requirement: Comment creation and soft-delete

Authorized users SHALL be able to add a plain-text comment and SHALL be able to delete their own comments within 24 hours of creation. Admins SHALL be able to delete any comment at any time. Deletion SHALL be a soft delete. All of these operations SHALL work offline via enqueueing to `sync_outbox`, with the UI reflecting the change immediately against local DB.

#### Scenario: Offline add comment

- **GIVEN** offline
- **WHEN** an assigned servant adds a comment on Maria's profile
- **THEN** the comment appears immediately in the Comments tab with a "cloud-pending" indicator
- **AND** a `sync_outbox` entry is created

#### Scenario: Offline delete comment

- **GIVEN** offline
- **AND** a servant's own comment within the edit window
- **WHEN** they delete it
- **THEN** it disappears from the UI locally
- **AND** a `sync_outbox` entry for the deletion is created
- **AND** on reconnect the deletion is persisted server-side

### Requirement: Edit screen

The Person edit screen SHALL submit changes via the sync layer — online: immediate dispatch; offline: queued with optimistic local write.

#### Scenario: Offline edit

- **GIVEN** offline
- **WHEN** a servant changes Maria's region and saves
- **THEN** the local `persons` row updates with `updated_at = now(device)`
- **AND** a `sync_outbox` entry is queued
- **AND** the detail screen reflects the new value

### Requirement: Admin-only reassign action

Admin reassignment SHALL work online or offline; when offline, the reassign is queued and the local assignment reflects the intent immediately. Comment access transitions respect the local assignment.

#### Scenario: Offline reassign

- **GIVEN** an admin is offline
- **AND** Maria is assigned to servant A
- **WHEN** the admin reassigns Maria to servant B
- **THEN** locally, `assigned_servant_id = B`
- **AND** a sync outbox entry is queued
- **AND** an admin with offline access to comments retains visibility (admin sees all)
