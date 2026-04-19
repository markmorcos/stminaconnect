## Why

This is the app's highest-frequency action: during a service, a servant checks people in. Every other feature (absence detection, dashboards, follow-ups) depends on this data. We ship it online-first in this change, then add offline support in the very next change — separating the concerns keeps scope clear and lets us validate the core data flow before layering sync logic.

## What Changes

- **ADDED** `attendance` capability:
  - `attendance` table: `(id, person_id, event_id, marked_by, marked_at)`; unique `(person_id, event_id)`; soft deletes via `archived_at`.
  - RLS: any authenticated active user can INSERT/UPDATE/SELECT (attendance is shared data); DELETE restricted to admin + original `marked_by` within edit window.
  - Edit window: until 23:59:59 Europe/Berlin on the day of the event.
  - RPCs: `mark_attendance(person_id, event_id)`, `unmark_attendance(person_id, event_id)`, `list_attendance_for_event(event_id)`, `list_attendance_for_person(person_id, limit)`.
  - Check-In tab: pick today's event → see list of assigned members (all unmarked by default) → tap to mark → search bar searches all active members → save icon shows sync state (for this change: request sent, pending, done).
  - Person detail Attendance tab: now shows attendance history.
- Fully online-only in this change; no local queue. An offline tap shows a "not connected" error.

## Impact

- **Affected specs:** `attendance` (new), `person-management` (MODIFIED — attendance tab now has content)
- **Affected code (preview):**
  - Migrations: `012_create_attendance.sql`, `013_attendance_rls.sql`, `014_attendance_rpcs.sql`
  - Mobile: new `(tabs)` entry `check-in`, `app/check-in/index.tsx` (event picker), `app/check-in/[eventId].tsx` (roster), `features/attendance/hooks/*`, `services/api/attendance.ts`
  - i18n: `attendance.json`
  - Tests: unit tests for mark/unmark, integration tests for RLS + edit window, UI tests for roster interactions
- **Breaking changes:** none.
- **Migration needs:** 3 migrations.
- **Depends on:** `add-google-calendar-sync` (events), `add-person-data-model`, `add-i18n-foundation`.
