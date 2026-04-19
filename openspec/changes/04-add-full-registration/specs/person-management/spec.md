## ADDED Requirements

### Requirement: Person detail screen

The system SHALL provide a Person detail screen at route `/person/[id]` with three tabs: Info, Attendance, Comments. The screen SHALL show a header with name, status badge, and assigned servant.

#### Scenario: Open person detail

- **GIVEN** a servant taps a person in any list
- **WHEN** the detail screen loads
- **THEN** name, status badge (new/active/inactive), and assigned-servant avatar are shown in the header
- **AND** three tabs (Info, Attendance, Comments) are present
- **AND** the Info tab is active by default

### Requirement: Info tab shows all non-private fields

The Info tab SHALL show phone (tappable to call), region, language, priority, registered_at (formatted), and who registered (display_name).

#### Scenario: Info tab contents

- **GIVEN** Maria's detail screen
- **WHEN** viewing the Info tab
- **THEN** all the above fields are visible in the active language's formatting
- **AND** tapping the phone number opens the OS dialer

### Requirement: Comments tab honors RLS

The Comments tab SHALL distinguish between three states: (a) visible with comments, (b) visible and empty, (c) hidden due to lack of access.

#### Scenario: Assigned servant sees comments

- **GIVEN** servant A is assigned to Maria; Maria has 2 comments
- **WHEN** A opens the Comments tab
- **THEN** both comments render, each with author name + timestamp
- **AND** an input to add a new comment is present at the bottom

#### Scenario: Assigned servant with no comments sees add UI

- **GIVEN** servant A assigned to Maria; Maria has 0 comments
- **WHEN** A opens the Comments tab
- **THEN** an empty state reads "No comments yet"
- **AND** the add-comment input is present

#### Scenario: Unassigned servant sees lock state

- **GIVEN** servant A authenticated; Maria assigned to servant B
- **WHEN** A opens the Comments tab
- **THEN** the tab shows a lock icon and the text "Comments are visible to the assigned servant."
- **AND** no individual comment content is rendered
- **AND** the add-comment input is absent

#### Scenario: Admin sees all comments

- **GIVEN** an admin is authenticated
- **WHEN** they open Maria's Comments tab
- **THEN** all comments are visible regardless of assignment
- **AND** the add-comment input is present

### Requirement: Comment creation and soft-delete

Authorized users SHALL be able to add a plain-text comment and SHALL be able to delete their own comments within 24 hours of creation. Admins SHALL be able to delete any comment at any time. Deletion SHALL be a soft delete (`archived_at` set).

#### Scenario: Add comment

- **GIVEN** servant A on Maria's Comments tab (A is assigned)
- **WHEN** they type "Called today, no answer" and tap Send
- **THEN** a new row is inserted in `person_comments` with `author_id = A`
- **AND** the comment appears in the list without a reload

#### Scenario: Delete own comment within window

- **GIVEN** servant A posted a comment 10 minutes ago
- **WHEN** they tap delete on that comment and confirm
- **THEN** the comment's `archived_at` is set
- **AND** the comment disappears from the list

#### Scenario: Cannot delete other's comment

- **GIVEN** servant A is assigned; the comment's author is servant B (A sees it because A is the *current* assignee after a reassignment)
- **WHEN** A long-presses the comment
- **THEN** delete is not offered (only admins can delete others)

### Requirement: Admin-only reassign action

The Person detail header SHALL expose a "Reassign" action in an overflow menu that is visible ONLY to admins. Tapping it SHALL show a servant picker and confirm dialog, then call `reassign_person`.

#### Scenario: Servant does not see reassign

- **GIVEN** an authenticated servant viewing Maria
- **WHEN** they tap the overflow menu
- **THEN** no "Reassign" item is listed

#### Scenario: Admin reassigns

- **GIVEN** an authenticated admin viewing Maria (assigned to servant A)
- **WHEN** they tap Reassign → pick servant B → Confirm
- **THEN** the RPC `reassign_person(maria_id, servant_b_id)` is called
- **AND** on success, the header updates to show servant B
- **AND** the comment-access state of the admin's own view does not change (still sees all)
- **AND** servant A's next session refresh loses comment access to Maria

### Requirement: Edit screen

The system SHALL provide `/person/[id]/edit` that reuses the Full Registration form pre-populated from `get_person`. Saving SHALL call `update_person` with the changed fields.

#### Scenario: Edit and save

- **GIVEN** Maria's detail is open; current user is the assigned servant
- **WHEN** they tap Edit, change region from "Neuhausen" to "Schwabing", and save
- **THEN** `update_person(maria_id, { region: 'Schwabing' })` is called
- **AND** the detail screen reflects the new region on return
