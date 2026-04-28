# offline-sync — Spec Delta

## ADDED Requirements

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
