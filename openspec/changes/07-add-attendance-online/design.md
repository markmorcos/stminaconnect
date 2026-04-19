## Context

Check-in happens quickly and under time pressure (a service is in progress). The UX must prioritize throughput: large tap targets, optimistic UI, fast search. The data model is intentionally simple so it's easy to reason about: attendance is a unique (person, event) pair, with audit metadata.

Two servants checking in the same person to the same event is handled via `ON CONFLICT DO UPDATE` — see Open Question #10.

## Goals

- Tap → visual confirmation in <100ms (optimistic UI).
- Roster shows assigned members first, then all others via search.
- Attendance appears in the person's history the moment it's saved.
- Edits (wrong tap) reversible until end of day (Europe/Berlin).

## Non-Goals

- No offline support — explicitly the next change's scope.
- No bulk check-in ("check in all assigned"). Too easy to abuse; servants tap individually.
- No event-level admin workflow (locking attendance after the day, etc.) — all edits cut off automatically at midnight.
- No "attendee confirmation" — members do not self-check-in.

## Decisions

1. **Unique `(person_id, event_id)` with upsert semantics.** Duplicate taps from two devices land in one row; the later `marked_at` wins, `marked_by` reflects that winner. This is Open Question #10's default.

2. **Optimistic UI via TanStack Query's `onMutate`.** Tap immediately flips the row to "marked"; on error, revert and show a toast. This keeps the UX snappy during brief network blips.

3. **Search is server-side** via `list_persons({ query, limit: 50 })`. Client-side filtering on 200 members would be fine performance-wise, but server-side is future-proof for growth and uses a single already-existing RPC.

4. **Edit window enforcement in the RPC, not just RLS.** RLS can express "within edit window" but it's clearer in the RPC which can return a typed error `EDIT_WINDOW_CLOSED`.

5. **Attendance tab on Person detail uses `list_attendance_for_person(person_id, limit: 20)`.** Shows date + event title. Clicking an entry navigates to that event's roster.

6. **Sync state in this change is a simple spinner + checkmark per row.** The full "offline queue" UI lands next.

7. **Roster is ordered**: (1) assigned members of the checking-in servant (alphabetical), (2) then all marked attendees grouped at top with a visual divider after save. This helps the servant see their own group at a glance.

## Risks / Trade-offs

- **Risk:** Optimistic UI on spotty networks can look "double-confirmed" if a retry fires. Mitigated by idempotent upsert.
- **Trade-off:** No bulk actions means higher tap count for large groups. Acceptable at our scale.

## Open Questions

See `_open-questions.md` #6 (edit window) and #10 (conflict resolution). Defaults implemented.
