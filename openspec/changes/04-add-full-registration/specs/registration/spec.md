## ADDED Requirements

### Requirement: Full Registration form

The system SHALL provide a Full Registration flow that captures all Quick Add fields plus `priority`, `assigned_servant`, and optional `comment` (initial comment added to the person's comments).

#### Scenario: Full registration from scratch

- **GIVEN** a servant on the home tab
- **WHEN** they tap "New member" (secondary action) and fill all fields including priority = `high`, assigned_servant = self, comment = "Met at coffee hour, interested in choir"
- **AND** tap Save
- **THEN** `create_person` is called with `registration_type = 'full'` and the listed fields
- **AND** the comment is inserted as a `person_comments` row with `author_id = current user`
- **AND** on success, the servant navigates to the new Person detail

#### Scenario: Assigned-servant defaults to current user

- **GIVEN** the Full Registration form opens
- **WHEN** the assigned-servant picker is first rendered
- **THEN** the current user is pre-selected
- **AND** the servant can change it to any other active servant

### Requirement: Upgrade from Quick Add to Full

A Person with `registration_type = 'quick_add'` SHALL have a "Complete details" action on their profile that opens the Full Registration form pre-populated with existing fields. Saving SHALL update the record to `registration_type = 'full'` without changing `registered_at`.

#### Scenario: Upgrade flow

- **GIVEN** Maria was registered via Quick Add yesterday
- **WHEN** the assigned servant opens Maria's profile and taps "Complete details"
- **THEN** the Full Registration form opens with all current fields populated
- **AND** on save, `registration_type` becomes `'full'` and `registered_at` is unchanged
- **AND** any new comment entered is appended to `person_comments`

#### Scenario: Already-full person has no upgrade action

- **GIVEN** a person with `registration_type = 'full'`
- **WHEN** viewing their profile
- **THEN** no "Complete details" action is shown

## MODIFIED Requirements

### Requirement: Auto-assignment to initiating servant

(The Quick Add auto-assignment requirement remains unchanged; this is MODIFIED only to note the scope narrowing — Full Registration explicitly allows servant selection.)

Quick Add SHALL always set `assigned_servant_id` to the current authenticated user's id. Full Registration SHALL default to the current user but MAY be changed to any active servant.

#### Scenario: Assignment is automatic in Quick Add

- **GIVEN** servant A is authenticated
- **WHEN** they submit a valid Quick Add form
- **THEN** the created person's `assigned_servant_id` equals servant A's id
- **AND** no servant-picker control is visible

#### Scenario: Assignment is selectable in Full Registration

- **GIVEN** servant A is authenticated on the Full Registration form
- **WHEN** they select servant B in the assigned-servant picker and save
- **THEN** the created person's `assigned_servant_id` equals servant B's id
