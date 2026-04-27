# person-management — Spec Delta

This delta is introduced by `add-absence-detection`. The deep-link
target for `absence_alert` notifications is `/persons/[personId]`, but
the local SQLite mirror is not guaranteed to contain the row at the
moment the deep link is followed (initial sync still in flight, sync
gap, or a notification recipient who is not normally the assigned
servant). The original "render via the local cache" requirement
returned a missing-row error in that case; we now require a
graceful Supabase RPC fallback so deep links land successfully.

## MODIFIED Requirements

### Requirement: Person list and profile screens SHALL render data via RPCs only.

The persons list and profile screens MUST fetch data through
`services/api/persons.ts`, which reads from the local SQLite cache
populated by the SyncEngine. The screens MUST NOT call the persons
RPCs directly at render time. Writes (Quick Add, edit, soft-delete)
MUST go through the local sync queue.

`getPerson(id)` MUST fall back to the `get_person` RPC when the local
cache returns null. On a successful fallback the row MUST be written
into the local mirror so subsequent reads resolve from cache. The
fallback SHALL respect server-side visibility (a deleted row is
returned as null without polluting the cache).

The `comments`-visibility rule from the original requirement is
unchanged: visibility is determined server-side and cached locally per
person.

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

#### Scenario: Deep link to uncached person falls back to RPC and caches the row

- **GIVEN** the local cache does NOT contain person P
- **AND** the user taps a notification deep-linking to `/persons/<P.id>`
- **WHEN** the profile screen calls `getPerson(P.id)`
- **THEN** the call invokes the `get_person` RPC
- **AND** the returned row is written into the local cache via `upsertPersons([row], 'synced')`
- **AND** the screen renders the profile
- **AND** a subsequent re-mount of the same screen reads from local cache without another RPC

#### Scenario: RPC fallback honors server-side soft-delete

- **GIVEN** the local cache does NOT contain person P
- **AND** P is soft-deleted server-side (`deleted_at IS NOT NULL`)
- **WHEN** `getPerson(P.id)` is called
- **THEN** the RPC returns the deleted row, which the wrapper treats as null
- **AND** no row is written into the local cache
- **AND** the screen renders the not-found state
