## Why

With persons and events both modeled, we can finally build the core check-in flow. We deliberately ship the **online-only** version first — store data on Supabase directly, treat network failure as a hard error. Phase 10 then adds the offline queue. Splitting these gives us a clean, complete implementation of the happy path before adding the complexity of local persistence and conflict resolution.

## What Changes

- **ADDED** capability `attendance`.
- **ADDED** `attendance` table:
  - `id`, `event_id` (FK), `person_id` (FK), `marked_by` (FK to servants), `marked_at`, `is_present` (true; absence is implicit per Open Question C2 — this column is here for future-proofing, but only true rows are inserted in v1).
  - Unique constraint on `(event_id, person_id)`.
- **ADDED** Check-in flow:
  - Home tile "Check In" → opens event picker (today's events from `get_today_events`).
  - Event picker → roster screen.
  - Roster screen: top section "My Group" (servant's assigned persons, all unchecked initially); bottom section search ("Find someone else").
  - Tap a person → toggles checked. Save batches into a single RPC call.
- **ADDED** RPCs:
  - `mark_attendance(event_id uuid, person_ids uuid[])` upserts `is_present=true` rows for the (event, person) pairs not already present.
  - `unmark_attendance(event_id uuid, person_ids uuid[])` deletes rows for the pairs.
  - `get_event_attendance(event_id uuid)` returns the set of `person_id`s already marked present (used to render check states on the roster).
  - `search_persons(query text)` — for the "Find someone else" search; ILIKE on names.
- **ADDED** Edit window enforcement: attendance is editable until 03:00 Europe/Berlin the day after the event's start (Open Question C1). RPCs reject mutations outside the window.
- **ADDED** Translation keys `attendance.*`.

## Impact

- **Affected specs**: `attendance` (new).
- **Affected code**: `supabase/migrations/014_attendance.sql`, `015_attendance_rpcs.sql`. New `app/(app)/attendance/{index.tsx,[eventId].tsx}`. New `src/services/api/attendance.ts`. New `src/features/attendance/*`.
- **Breaking changes**: none.
- **Migration needs**: two migrations.
- **Expo Go compatible**: yes — pure UI + RPC.
- **Online-only constraint**: failures during save MUST surface clearly; phase 10 swaps in the offline queue.
- **Uses design system**: all UI built with components/tokens from the design-system capability. No ad-hoc styles.
- **Dependencies**: `add-person-data-model`, `add-google-calendar-sync`.
