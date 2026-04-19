## ADDED Requirements

### Requirement: Persons table shape

The system SHALL maintain a `persons` table capturing every attribute required by downstream features:

- Identity: `id (uuid pk)`, `first_name text not null`, `last_name text not null`
- Contact: `phone text not null` with E.164-like CHECK
- Context: `region text`, `language person_language not null default 'en'`
- Assignment & classification: `assigned_servant_id uuid references profiles(id)`, `priority person_priority not null default 'medium'`, `status person_status not null default 'new'`
- Registration metadata: `registration_type registration_type not null`, `registered_by uuid references profiles(id)`, `registered_at timestamptz not null default now()`
- Audit: `created_at`, `updated_at`, `created_by`, `updated_by`, `archived_at`

#### Scenario: Schema accepts a valid minimum person

- **GIVEN** an authenticated servant
- **WHEN** they call `create_person({ first_name: 'Maria', last_name: 'Youssef', phone: '+4915112345678', language: 'ar', registration_type: 'quick_add' })`
- **THEN** a new row is created with `status = 'new'`, `priority = 'medium'`, `registered_by = auth.uid()`, `registered_at = now()`, `assigned_servant_id = auth.uid()` (set by client for quick_add)

#### Scenario: Schema rejects bad phone

- **GIVEN** an authenticated servant
- **WHEN** they call `create_person({ ..., phone: '12345', ... })`
- **THEN** the call fails due to the CHECK constraint on phone format

### Requirement: Servants can read all non-archived persons

The RLS policy SHALL allow any authenticated, active user to SELECT persons whose `archived_at IS NULL`, so servants can search the full member roster for event-day check-in.

#### Scenario: Servant searches for any member

- **GIVEN** servant A (not assigned to Maria) is authenticated
- **WHEN** they query `list_persons({ query: 'Maria' })`
- **THEN** Maria appears in the results regardless of her assigned servant

#### Scenario: Archived persons hidden from servants

- **GIVEN** a person with `archived_at` set to yesterday
- **WHEN** any servant runs `list_persons` without an explicit archived filter
- **THEN** the archived person does not appear
- **AND** admins can opt in via `list_persons({ include_archived: true })`

### Requirement: Servants can write only their assigned persons

The RLS policy SHALL allow INSERT and UPDATE on `persons` only when the caller is an admin or the row's `assigned_servant_id` equals the caller's `auth.uid()`.

#### Scenario: Servant updates own assignment

- **GIVEN** servant A is assigned to Maria
- **WHEN** they update Maria's region
- **THEN** the update succeeds

#### Scenario: Servant cannot update another servant's assignment

- **GIVEN** servant A authenticated; Maria assigned to servant B
- **WHEN** servant A attempts to update Maria's region
- **THEN** the update is blocked by RLS (zero rows affected or explicit exception)

#### Scenario: Servant cannot reassign

- **GIVEN** servant A assigned to Maria
- **WHEN** servant A calls `update_person(maria_id, { assigned_servant_id: servant_b_id })`
- **THEN** the call fails — reassignment requires admin via `reassign_person`

### Requirement: Comments are private to the assigned servant and admins

The `person_comments` table SHALL be readable only by the person's currently-assigned servant and by admins. Comments SHALL NOT follow the broad SELECT policy of `persons`.

#### Scenario: Servant reads own assignment's comments

- **GIVEN** servant A is assigned to Maria with 2 comments
- **WHEN** servant A calls `get_person(maria_id)`
- **THEN** both comments are returned

#### Scenario: Servant cannot read unassigned comments

- **GIVEN** servant A authenticated; Maria assigned to servant B
- **WHEN** servant A calls `get_person(maria_id)`
- **THEN** the person's core fields are returned (from broad persons SELECT policy) but the `comments` array is empty

#### Scenario: Reassignment transfers comment access

- **GIVEN** Maria's comments were written while assigned to servant B
- **WHEN** an admin reassigns Maria to servant A
- **THEN** servant A can now read all prior comments
- **AND** servant B can no longer read them

#### Scenario: Admin sees all comments

- **GIVEN** an admin authenticated
- **WHEN** they call `get_person(maria_id)`
- **THEN** all comments are returned regardless of assignment

### Requirement: Admin-only reassignment

The `reassign_person(id, new_servant_id)` RPC SHALL be callable only by admins and SHALL update the row's `assigned_servant_id` atomically.

#### Scenario: Admin reassigns

- **GIVEN** Maria is assigned to servant A; an admin is authenticated
- **WHEN** the admin calls `reassign_person(maria_id, servant_b_id)`
- **THEN** Maria's `assigned_servant_id` becomes servant B
- **AND** `updated_at` / `updated_by` reflect the admin action

#### Scenario: Servant cannot reassign via RPC

- **GIVEN** servant A is authenticated
- **WHEN** they call `reassign_person(maria_id, servant_b_id)`
- **THEN** the RPC raises an insufficient-privileges exception

### Requirement: Unassigned persons are admin-only writable

Persons with `assigned_servant_id IS NULL` (e.g. after a servant's deactivation) SHALL be writable only by admins.

#### Scenario: Unassigned person locked to servants

- **GIVEN** Maria's `assigned_servant_id` is null
- **WHEN** any servant attempts to update Maria
- **THEN** the update is blocked by RLS
- **AND** an admin update succeeds

### Requirement: Seed produces a realistic local dataset

`make seed` SHALL produce a deterministic local dataset with 2 admins, 5 servants, 20 persons spread across languages, priorities, and regions, and 3 sample comments.

#### Scenario: Reproducible seed

- **GIVEN** a freshly reset local database
- **WHEN** the developer runs `make seed`
- **THEN** the database contains exactly 2 admin profiles, 5 servant profiles, 20 persons, and 3 comments
- **AND** running `make reset-db` followed by `make seed` produces an identical state

### Requirement: Generated types reflect the live schema

A `make gen-types` command SHALL update `apps/mobile/src/types/database.generated.ts` from the local Supabase schema, and this file SHALL be committed.

#### Scenario: Typecheck catches schema drift

- **GIVEN** a developer removes a column from `persons` in a migration but forgets to run `make gen-types`
- **WHEN** CI runs `make typecheck`
- **THEN** it fails because a mobile file references the now-removed column via the generated type
