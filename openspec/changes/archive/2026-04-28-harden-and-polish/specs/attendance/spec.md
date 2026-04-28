# attendance — Spec Delta

## MODIFIED Requirements

### Requirement: Attendance SHALL be recorded as `(event, person)` rows; absence is implicit.

Each present check-in MUST be one row in `attendance` with `is_present=true`; absence MUST be modeled as the absence of such a row. From this change forward, the `get_event_attendance` projection MUST include a `deleted` boolean derived from `persons.deleted_at IS NOT NULL`. UI MUST render the display name as the localized "Removed Member" string when `deleted=true`. Historical attendance rows referencing soft-deleted persons MUST remain visible in admin queries — the row itself is not deleted, only its display is anonymized.

#### Scenario: Soft-deleted attendee renders as Removed Member

- **GIVEN** event E with attendance for person P, and P has been soft-deleted
- **WHEN** any servant opens E's roster (or attendance history view, when added)
- **THEN** P's row displays the localized "Removed Member" placeholder
- **AND** the underlying attendance row's `marked_at` and `marked_by` are unchanged

#### Scenario: Aggregate stats include soft-deleted-attended events

- **GIVEN** event E had 12 attendees, 1 of whom has since been soft-deleted
- **WHEN** the admin dashboard renders attendance counts for E
- **THEN** the count is 12
- **AND** the soft-deleted person contributes only as an anonymous row
