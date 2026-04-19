## MODIFIED Requirements

### Requirement: Submission handles network failure gracefully

A Quick Add or Full Registration submission SHALL always succeed from the user's perspective when form values are valid: if online, it is dispatched immediately; if offline or the network fails, it is enqueued to `sync_outbox` with optimistic write to local DB, and the user receives a toast indicating the save is pending sync.

#### Scenario: Online success

- **GIVEN** the servant is online
- **WHEN** they submit a valid Quick Add
- **THEN** `create_person` is dispatched and succeeds
- **AND** the toast reads "Maria added — assigned to you."

#### Scenario: Offline enqueues

- **GIVEN** the device is offline
- **WHEN** the servant submits a valid Quick Add
- **THEN** a local `persons` row is inserted with a local UUID
- **AND** a `sync_outbox` entry is created with `mutation_kind = create_person`
- **AND** the toast reads "Maria added (saved offline — will sync)"
- **AND** the Person is immediately browsable in lists and detail

#### Scenario: Online server failure

- **GIVEN** online
- **WHEN** submission is attempted and the server returns a 5xx
- **THEN** the mutation is moved to `sync_outbox` with `status = failed`
- **AND** the toast reads "Save pending — will retry automatically."
- **AND** the banner surfaces the error state
