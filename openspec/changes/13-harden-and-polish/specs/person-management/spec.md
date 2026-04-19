## ADDED Requirements

### Requirement: Admin hard-delete for GDPR

An admin SHALL be able to permanently delete a Person and all associated attendance, comments, alerts, and follow-ups via `hard_delete_person(id, reason)` RPC. The action SHALL be irreversible and require two-factor confirmation in UI (typing the person's full name + selecting a reason).

#### Scenario: Admin hard-deletes a member

- **GIVEN** an admin on Maria's profile
- **WHEN** they open overflow → "Delete permanently"
- **THEN** a confirm screen appears requiring the admin to type "Maria Youssef" and pick a reason from a list
- **WHEN** they confirm
- **THEN** `hard_delete_person` is called
- **AND** the row is removed along with all attendance, comments, alerts, follow-ups
- **AND** a row is inserted into `admin_deletion_audit` with `performed_by`, `performed_at`, `reason`, hashed name + phone
- **AND** the admin is navigated back; a success toast confirms

#### Scenario: Non-admin cannot hard delete

- **GIVEN** a servant on any profile
- **WHEN** they open overflow
- **THEN** no "Delete permanently" option is listed
- **AND** calling the RPC directly raises insufficient-privileges

#### Scenario: Cascades work

- **GIVEN** Maria has 2 attendance rows, 1 comment, 1 alert, 1 follow-up
- **WHEN** she is hard-deleted
- **THEN** all 4 dependent rows are gone
- **AND** no foreign-key errors occur
