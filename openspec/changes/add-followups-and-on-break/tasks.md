# Tasks — add-followups-and-on-break

## 1. Schema

- [ ] 1.1 `020_follow_ups.sql`: follow_ups table per design + indexes.
- [ ] 1.2 RLS: select `created_by = auth.uid() OR role='admin'`; insert any servant; update/delete creator within 1h.
- [ ] 1.3 `021_on_break_helpers.sql`: `pg_cron` daily 23:00 Berlin → `update persons set status='active', paused_until=null where status='on_break' and paused_until <= current_date; select detect_absences(...)`.
- [ ] 1.4 `022_return_detection.sql`: extend `mark_attendance` to invoke a return-detection routine post-commit.

## 2. RPCs

- [ ] 2.1 `create_follow_up(payload jsonb) returns follow_ups`.
- [ ] 2.2 `update_follow_up(id, payload jsonb)`.
- [ ] 2.3 `list_follow_ups_pending(servant_id uuid default auth.uid())` — returns the three-section dataset.
- [ ] 2.4 `mark_on_break(person_id, paused_until date)` and `end_break(person_id)`.

## 3. Mobile API

- [ ] 3.1 `src/services/api/followUps.ts`.
- [ ] 3.2 `src/services/api/onBreak.ts`.
- [ ] 3.3 Sync engine ops: `create_follow_up`, `update_follow_up`, `mark_on_break`, `end_break` added to op handlers.

## 4. Screens

- [ ] 4.1 `app/(app)/persons/[id]/follow-up.tsx` modal sheet — form: action chip-row, notes, status toggle, snooze date picker if snoozed.
- [ ] 4.2 Auto-open on `?openFollowUp=true` query param of profile route.
- [ ] 4.3 `app/(app)/persons/[id]/on-break.tsx` modal sheet — date picker + open-ended toggle.
- [ ] 4.4 `app/(app)/follow-ups.tsx` — three-section list, pull to refresh.
- [ ] 4.5 Profile additions: "Log follow-up" button, "Mark on break" / "End break" toggle button per state.

## 5. Notification router

- [ ] 5.1 `absence_alert` → `/persons/[personId]?openFollowUp=true`.
- [ ] 5.2 `welcome_back` → `/persons/[personId]`.

## 6. Translations

- [ ] 6.1 `followUps.*`: pendingTitle, sections.{needsFollowUp,snoozedReturning,recent}, action.{called,texted,visited,no_answer,other}, status.{completed,snoozed}, snoozeUntil, save, success, errorPermissionUpdate.
- [ ] 6.2 `persons.onBreak.*`: button, dialogTitle, untilLabel, openEnded, save, endBreak, success.
- [ ] 6.3 `notifications.types.welcome_back.title|body`: "Welcome back: {personName}", "Attended {eventTitle} on {eventDate}".

## 7. Tests

- [ ] 7.1 Integration: `create_follow_up` succeeds for any servant; only creator can update within 1h; admin can SELECT all; non-creator non-admin cannot SELECT.
- [ ] 7.2 Integration: `mark_on_break` sets status + paused_until; detection skips events in window.
- [ ] 7.3 Integration: daily cron simulation: persons with paused_until=yesterday flip to active.
- [ ] 7.4 Integration: marking attendance for an alerted person sets resolved_at and dispatches welcome_back.
- [ ] 7.5 Integration: only assigned servant receives welcome_back (no admin spam).
- [ ] 7.6 Component: follow-up form validates action selection; snoozed requires date.
- [ ] 7.7 Component: pending list renders three sections.

## 8. Verification (in Expo Go)

- [ ] 8.1 Trigger an absence alert from prior phase → tap banner → profile opens with follow-up modal pre-opened.
- [ ] 8.2 Log "Texted" with note → save → modal closes; follow-up appears in `/follow-ups` "Recently logged".
- [ ] 8.3 Mark a person on break (next 14 days) → run a counted-event detection cycle → person not flagged.
- [ ] 8.4 Mark attendance for a previously-alerted person → welcome_back banner appears in assigned servant's app within seconds. Admin (different account) does NOT receive it.
- [ ] 8.5 Snooze a follow-up to tomorrow → list shows it under "Returning today/tomorrow" the next day.
- [ ] 8.6 End a break early via profile → person resumes detection (verify alert if streak ≥ threshold).
- [ ] 8.7 Switch to AR → follow-up labels render correctly.
- [ ] 8.8 `openspec validate add-followups-and-on-break` passes.
