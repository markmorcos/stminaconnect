## MODIFIED Requirements

### Requirement: Person detail screen

The Person detail screen's Attendance tab, previously a stub, SHALL now render the person's attendance history via `list_attendance_for_person(id, 20)`, sorted newest first. Each entry SHALL show the event title, the event's local date, and the `marked_by` display name.

#### Scenario: Attendance tab with data

- **GIVEN** Maria has 3 non-archived attendance entries
- **WHEN** a servant assigned to Maria opens her Attendance tab
- **THEN** 3 rows render, newest first, each showing event title, date, and who marked her

#### Scenario: Attendance tab empty state

- **GIVEN** Maria has no attendance records
- **WHEN** a servant opens the Attendance tab
- **THEN** an empty state "No attendance recorded yet" is shown

#### Scenario: Tap attendance row navigates to roster

- **GIVEN** the Attendance tab shows an entry
- **WHEN** the servant taps it
- **THEN** the app navigates to that event's check-in roster

*(Info, Comments, and header requirements from the earlier `add-full-registration` spec remain unchanged.)*
