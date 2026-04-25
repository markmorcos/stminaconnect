# person-management — Spec Delta

## MODIFIED Requirements

### Requirement: Person list and profile screens SHALL render data via RPCs only.

The persons list and profile screens MUST fetch data through `services/api/persons.ts`, which from this change forward reads from the local SQLite cache populated by the SyncEngine. The screens MUST NOT call the persons RPCs directly at render time. Writes (Quick Add, edit, soft-delete) MUST go through the local sync queue. End-to-end behaviour visible to the user MUST be identical when online; offline support is now a first-class feature.

The `comments`-visibility rule from the original requirement is unchanged: visibility is determined server-side and cached locally per person.

#### Scenario: Persons list renders from local cache

- **GIVEN** the local cache contains 20 persons populated from a prior sync
- **AND** the device is offline
- **WHEN** the user opens the persons list
- **THEN** all 20 persons render
- **AND** no network request is dispatched for the read

#### Scenario: Profile renders offline with cached visibility

- **GIVEN** the local cache contains person P with `comments` populated for the current servant
- **AND** the device is offline
- **WHEN** the user opens P's profile
- **THEN** all fields render from local data including `comments`

#### Scenario: Comments cache respects server-side visibility

- **GIVEN** the local cache stores `comments=null` for person P (current servant lacks visibility per server)
- **WHEN** the profile renders
- **THEN** the comments-hidden banner is shown
- **AND** no comment text appears
