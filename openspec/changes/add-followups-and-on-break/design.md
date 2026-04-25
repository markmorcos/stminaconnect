## Context

Follow-ups are simple records — what action a servant took. The interesting part is the lifecycle around them: when an alert fires, the assigned servant should be nudged toward logging a follow-up; when they come back into the building (literally), the alert should resolve and the servant should be told. "On break" pauses everything cleanly.

## Goals

- Logging a follow-up takes ≤ 30 seconds.
- The "pending follow-ups" list is the servant's daily todo.
- "On break" is one tap from the profile + a date picker.
- Welcome-back notifications close the loop without manual cleanup.

## Non-Goals

- Tracking conversations as threads. v1 is single-shot follow-ups.
- Multi-step pastoral workflow templates.
- Auto-suggesting actions based on prior history.
- Bulk follow-up logging.

## Decisions

1. **`follow_ups` schema** as proposed; index on `person_id` and `(status, snooze_until)`.
2. **Action picker UX**: a row of Paper `Chip`s, single-select. Order: Called, Texted, Visited, No answer, Other. "Other" reveals a freetext "details" input.
3. **Notes field**: Paper `TextInput` multiline, 500 char limit, optional.
4. **Snooze**: when `status='snoozed'` selected, a date picker is required. Snooze defaults to 3 days from now. The follow-up reappears in "Snoozed → Returning today/tomorrow" 1 day before `snooze_until`.
5. **On-break UX**:
   - "Mark on break" button on profile (assigned servant or admin only).
   - Sheet with a date picker (`paused_until`) and an "Open ended" toggle (sets `paused_until` to a far-future date, e.g. 9999-12-31).
   - On save: `update_person` with `status='on_break'` + `paused_until`.
   - "End break early" button visible when `status='on_break'` — sets `status='active'` and `paused_until=null`, runs detection.
6. **Auto break expiry**: a daily `pg_cron` job (`23:00 Europe/Berlin`) sets `status='active'` for any person where `paused_until <= current_date`. Then runs `detect_absences(those_person_ids)`.
7. **Return detection**: integrated into `mark_attendance` post-commit. After insertion, for each affected `(event, person)` pair, query: are there `absence_alerts` rows for the person with `resolved_at IS NULL`? If yes, set `resolved_at = now()` and dispatch a `welcome_back` notification. Recipients: **assigned servant only** (per Open Question D2). The notification's deep link goes to the person profile.
8. **`welcome_back` payload**:
   ```typescript
   { personId, personName, eventTitle, eventDate }
   ```
9. **Pending follow-ups list (`/follow-ups`)**: three sections, sorted within each by urgency:
   - **Needs follow-up**: `absence_alerts` with no `follow_ups` row OR follow-ups all completed but a newer alert exists.
   - **Snoozed → returning today/tomorrow**: snoozed follow-ups with `snooze_until` ≤ today + 1.
   - **Recently logged**: latest 20 follow-ups by the current servant (last 14 days). Visible for context.
10. **Routing from notification**: `absence_alert` deep links to `/persons/[id]?openFollowUp=true`. The query param triggers the follow-up form to open as a modal sheet on profile mount. After save, the modal closes.
11. **Privacy**: follow-ups are visible to admins and the creator. Specifically:
    - SELECT: `follow_ups.created_by = auth.uid()` OR caller is admin.
    - INSERT: any signed-in servant.
    - UPDATE/DELETE: only creator (within 1h of creation; immutable after).
12. **No "did this help?" rating**, no "outcome" tracking. Follow-ups are observational logs, not workflow tickets.

## Risks / Trade-offs

- **Risk**: too many notifications could fatigue. Mitigated by Open Question D1 (one alert per crossing) + welcome-back going to assigned servant only + snooze functionality.
- **Risk**: a follow-up logged as "no_answer" doesn't resolve the alert. Mitigation: that's by design — the alert remains; servants can re-attempt or snooze.
- **Trade-off**: alert resolution triggers only on actual attendance, not on a manual "mark resolved" button. Acceptable: keeps the loop clean and resists accidental dismissal.

## Migration Plan

- Three migrations, daily cron, integration into existing `mark_attendance` RPC.

## Open Questions

- **D2** resolved (assigned servant only).
