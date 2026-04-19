## 1. Schema

- [ ] 1.1 Migration `012_create_attendance.sql`: `attendance` table with unique `(person_id, event_id)`; columns `marked_at`, `marked_by`, `archived_at`
- [ ] 1.2 Migration `013_attendance_rls.sql`: all authenticated active users can SELECT/INSERT/UPDATE within edit window; DELETE restricted to original `marked_by` or admin
- [ ] 1.3 Migration `014_attendance_rpcs.sql`: `mark_attendance`, `unmark_attendance`, `list_attendance_for_event`, `list_attendance_for_person` — with edit-window checks returning typed errors
- [ ] 1.4 Integration tests: edit-window close rejects updates; upsert semantics on duplicate tap

## 2. Check-In flow

- [ ] 2.1 Add "Check In" tab to `(tabs)`; `app/check-in/index.tsx` shows today's events via `list_todays_events`
- [ ] 2.2 Tap event → `app/check-in/[eventId].tsx` roster screen
- [ ] 2.3 Roster: default shows current user's assigned members (unmarked on top, marked below); search bar expands to all active members
- [ ] 2.4 Marking: tap row → optimistic check; spinner → green checkmark; error → revert + toast
- [ ] 2.5 Unmarking: long-press or swipe on a marked row → confirm → RPC
- [ ] 2.6 Show "edit window closes at 23:59" hint in header

## 3. Person Attendance tab (person-management MODIFIED)

- [ ] 3.1 Attendance tab on `app/person/[id].tsx` now shows last 20 attendance entries (date + event title)
- [ ] 3.2 Tapping an entry navigates to that event's roster
- [ ] 3.3 Empty state: "No attendance recorded yet"

## 4. i18n

- [ ] 4.1 Add `locales/{en,ar,de}/attendance.json` with all screen strings
- [ ] 4.2 Manual check in each language

## 5. Verification

- [ ] 5.1 Manual: two devices marking the same person at nearly the same time both succeed; final row has later `marked_at`
- [ ] 5.2 Manual: mark, then unmark after midnight Berlin time → unmark fails with edit-window error
- [ ] 5.3 Manual: search finds any active member and allows check-in
- [ ] 5.4 `make test`, `make lint`, `make typecheck` pass
- [ ] 5.5 `openspec validate add-attendance-online` passes
- [ ] 5.6 Walk every scenario in `specs/attendance/spec.md` and the delta in `specs/person-management/spec.md`
