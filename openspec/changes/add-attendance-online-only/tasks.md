# Tasks — add-attendance-online-only

## 1. Schema

- [ ] 1.1 `014_attendance.sql`: attendance table + unique on `(event_id, person_id)` + index on `event_id`, `person_id`, `marked_by`.
- [ ] 1.2 RLS: any signed-in servant can SELECT (read), INSERT/UPDATE/DELETE only via RPCs (deny direct).
- [ ] 1.3 Helper SQL function `is_event_within_edit_window(event_id uuid) returns boolean`: computes Berlin cutoff.

## 2. RPCs

- [ ] 2.1 `015_attendance_rpcs.sql`:
  - `mark_attendance(event_id uuid, person_ids uuid[])` — verifies edit window; upserts rows; sets `marked_by=auth.uid()`, `marked_at=now()`.
  - `unmark_attendance(event_id uuid, person_ids uuid[])` — verifies edit window; deletes rows.
  - `get_event_attendance(event_id uuid) returns table(person_id uuid, marked_by uuid, marked_at timestamptz)`.
  - `search_persons(query text)` — case-insensitive ILIKE on first_name and last_name; limit 25; excludes soft-deleted; projection (id, first_name, last_name, region).

## 3. Mobile API

- [ ] 3.1 `src/services/api/attendance.ts`: typed wrappers `markAttendance`, `unmarkAttendance`, `getEventAttendance`, `searchPersons`.

## 4. Event picker

- [ ] 4.1 `app/(app)/attendance/_layout.tsx` — Stack header.
- [ ] 4.2 `app/(app)/attendance/index.tsx`:
  - Calls `getTodayEvents` via TanStack Query.
  - Shows event tiles with title, time, "counted" badge if applicable.
  - Empty state: "No events today" with a localized hint to check the calendar.
  - Tap → `router.push('/attendance/[eventId]')`.

## 5. Roster screen

- [ ] 5.1 `app/(app)/attendance/[eventId].tsx`:
  - Parallel fetches: event details (cached from list), my-group persons (`list_persons` filter), `get_event_attendance` for the event.
  - Renders sectioned list: My Group (with check states) + Search results.
  - Sticky search input at the top.
  - Tap row → toggles check, updates a local Set of pending adds/removes.
  - Save FAB shows count of pending changes; tapping Save calls `markAttendance` + `unmarkAttendance` in parallel.
  - On success: TanStack Query invalidation refreshes attendance state; Snackbar success.
  - On failure: Snackbar error; pending state preserved.
  - Edit-window banner if `is_event_within_edit_window` returns false: roster renders read-only.

## 6. Translations

- [ ] 6.1 Extend locales under `attendance.*`:
  - `picker.title`, `picker.empty`, `picker.countedBadge`.
  - `roster.title`, `roster.myGroup`, `roster.findSomeoneElse`, `roster.searchPlaceholder`, `roster.searchEmpty`.
  - `roster.save`, `roster.saveCount`, `roster.successSaved`, `roster.errorSave`.
  - `roster.editWindowClosed`, `roster.editWindowCutoff`.

## 7. Tests

- [ ] 7.1 Unit: `is_event_within_edit_window` returns true at 02:59 next day Berlin time; false at 03:01.
- [ ] 7.2 Integration: `mark_attendance` upserts; calling twice with same payload doesn't duplicate.
- [ ] 7.3 Integration: `mark_attendance` outside edit window returns error and inserts nothing.
- [ ] 7.4 Integration: `unmark_attendance` deletes only the targeted rows.
- [ ] 7.5 Integration: `search_persons` returns ≤25 rows; filters soft-deleted.
- [ ] 7.6 Component: roster toggles update pending count; save calls correct RPCs; failure preserves state.

## 8. Verification (in Expo Go)

- [ ] 8.1 As servant signed in to seeded data, ensure today has a counted event in calendar.
- [ ] 8.2 Tap Check In → today's events list → tap event → roster shows assigned persons with empty checks.
- [ ] 8.3 Toggle three persons → save → success snackbar → re-enter screen → those three remain checked.
- [ ] 8.4 Search "Mar" → search results section populates → tap one → row added to pending → save → success.
- [ ] 8.5 Untoggle a previously checked person → save → row removed from `attendance` table.
- [ ] 8.6 Manually back-date the event past the cutoff in DB → re-enter roster → read-only banner appears; toggling rows is disabled.
- [ ] 8.7 Disable Wi-Fi → tap Save → error snackbar; pending state preserved; re-enable Wi-Fi → tap Save again → success.
- [ ] 8.8 `openspec validate add-attendance-online-only` passes.
