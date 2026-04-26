# Tasks — add-attendance-online-only

## 1. Schema

- [x] 1.1 `015_attendance.sql`: attendance table + unique on `(event_id, person_id)` + index on `event_id`, `person_id`, `marked_by`.
- [x] 1.2 RLS: any signed-in servant can SELECT (read), INSERT/UPDATE/DELETE only via RPCs (deny direct).
- [x] 1.3 Helper SQL function `is_event_within_edit_window(event_id uuid) returns boolean`: computes Berlin cutoff.

## 2. RPCs

- [x] 2.1 `016_attendance_rpcs.sql` (numbered 016 to follow 015_attendance.sql):
  - `mark_attendance(event_id uuid, person_ids uuid[])` — verifies edit window; upserts rows; sets `marked_by=auth.uid()`, `marked_at=now()`.
  - `unmark_attendance(event_id uuid, person_ids uuid[])` — verifies edit window; deletes rows.
  - `get_event_attendance(event_id uuid) returns table(person_id uuid, marked_by uuid, marked_at timestamptz)`.
  - `search_persons(query text)` — case-insensitive ILIKE on first_name and last_name; limit 25; excludes soft-deleted; projection (id, first_name, last_name, region).

## 3. Mobile API

- [x] 3.1 `src/services/api/attendance.ts`: typed wrappers `markAttendance`, `unmarkAttendance`, `getEventAttendance`, `searchPersons` (plus `isEventWithinEditWindow` for the roster's read-only banner).

## 4. Event picker

- [x] 4.1 `app/(app)/attendance/_layout.tsx` — Stack header.
- [x] 4.2 `app/(app)/attendance/index.tsx`:
  - Calls `getTodayEvents` via TanStack Query.
  - Shows event tiles with title, time, "counted" badge if applicable.
  - Empty state: "No events today" with a localized hint to check the calendar.
  - Tap → `router.push('/attendance/[eventId]')`.

## 5. Roster screen

- [x] 5.1 `app/(app)/attendance/[eventId].tsx` (delegates to `src/features/attendance/RosterScreen.tsx`):
  - Parallel fetches: event details (cached from list), my-group persons (`list_persons` filter), `get_event_attendance` for the event.
  - Renders sectioned list: My Group (with check states) + Search results.
  - Sticky search input at the top.
  - Tap row → toggles check, updates a local Set of pending adds/removes.
  - Save FAB shows count of pending changes; tapping Save calls `markAttendance` + `unmarkAttendance` in parallel.
  - On success: TanStack Query invalidation refreshes attendance state; Snackbar success.
  - On failure: Snackbar error; pending state preserved.
  - Edit-window banner if `is_event_within_edit_window` returns false: roster renders read-only.

## 6. Translations

- [x] 6.1 Extend locales under `attendance.*` (en, de, ar):
  - `picker.title`, `picker.empty`, `picker.emptyHint`, `picker.countedBadge`, `picker.loadError`.
  - `roster.title`, `roster.myGroup`, `roster.myGroupEmpty`, `roster.findSomeoneElse`, `roster.searchPlaceholder`, `roster.searchEmpty`, `roster.searchHint`.
  - `roster.save`, `roster.saveCount_one`, `roster.saveCount_other`, `roster.successSaved`, `roster.errorSave`, `roster.errorEditWindowClosed`, `roster.loadError`.
  - `roster.editWindowClosed`, `roster.editWindowCutoff`.
  - Plus `home.checkIn` / `home.checkInSubtitle` for the home tile.

## 7. Tests

- [x] 7.1 Integration: `is_event_within_edit_window` returns true for an in-window event and false for one whose Berlin cutoff has passed. (`tests/attendance/rpcIntegration.test.ts`. Asserts the boundary by relative-to-now timestamps so the test stays green across DST.)
- [x] 7.2 Integration: `mark_attendance` upserts; calling twice with same payload doesn't duplicate. (`tests/attendance/rpcIntegration.test.ts`.)
- [x] 7.3 Integration: `mark_attendance` outside edit window returns error and inserts nothing.
- [x] 7.4 Integration: `unmark_attendance` deletes only the targeted rows.
- [x] 7.5 Integration: `search_persons` returns ≤25 rows; filters soft-deleted; empty/whitespace queries return nothing.
- [x] 7.6 Component: roster toggles update pending count; save calls correct RPCs; failure preserves state. (`tests/attendance/rosterScreen.test.tsx` plus pure-logic coverage in `tests/attendance/rosterState.test.ts` and wrapper coverage in `tests/attendance/attendanceService.test.ts`.)

## 8. Verification (in Expo Go)

- [x] 8.1 As servant signed in to seeded data, ensure today has a counted event in calendar. (Seed installs Lobpreis / Gebetsabend / Jugendversammlung / Jugendkonferenz patterns; Google Calendar sync flips matching events to is_counted=true.)
- [x] 8.2 Tap Check In → today's events list → tap event → roster shows assigned persons with empty checks.
- [x] 8.3 Toggle three persons → save → success snackbar → re-enter screen → those three remain checked.
- [x] 8.4 Search "Mar" → search results section populates → tap one → row added to pending → save → success. (Search input now also filters the My Group section so a query like "Mar" trims My Group to matching members and surfaces non-group hits below.)
- [x] 8.5 Untoggle a previously checked person → save → row removed from `attendance` table.
- [x] 8.6 Manually back-date the event past the cutoff in DB → re-enter roster → read-only banner appears; toggling rows is disabled. (Use `update public.events set start_at = now() - interval '3 days', end_at = now() - interval '3 days' + interval '1 hour' where id = '<uuid>';`.)
- [x] 8.7 Disable Wi-Fi → tap Save → error snackbar; pending state preserved; re-enable Wi-Fi → tap Save again → success. (Order matters: load the roster first, then drop Wi-Fi, then attempt Save. Disabling Wi-Fi before opening the roster hits the load-error path instead, which is expected for an online-only flow until phase 13.)
- [x] 8.8 `openspec validate add-attendance-online-only` passes.
