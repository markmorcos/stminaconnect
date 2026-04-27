# Tasks — add-followups-and-on-break

## 1. Schema

- [x] 1.1 `024_follow_ups.sql`: follow_ups table per design + indexes.
- [x] 1.2 RLS: select `created_by = auth.uid() OR role='admin'`; insert any servant; update/delete creator within 1h (enforced by `update_follow_up` RPC).
- [x] 1.3 `025_on_break.sql`: `pg_cron` daily 22:00 UTC (≈ 23:00 Europe/Berlin) → `expire_breaks()` flips persons with `paused_until <= current_date` to `active` and runs `detect_absences` on the affected ids.
- [x] 1.4 `026_return_detection.sql`: extends `mark_attendance` to invoke a `detect_returns` routine post-commit.

## 2. RPCs

- [x] 2.1 `create_follow_up(payload jsonb) returns follow_ups`.
- [x] 2.2 `update_follow_up(id, payload jsonb)` (creator-only, 1h immutability).
- [x] 2.3 `list_follow_ups_pending(servant_id uuid default auth.uid())` — returns the three-section dataset.
- [x] 2.4 `mark_on_break(person_id, paused_until date)` and `end_break(person_id)`.

## 3. Mobile API

- [x] 3.1 `src/services/api/followUps.ts` — `createFollowUp`, `updateFollowUp`, `listPendingFollowUps`.
- [x] 3.2 `src/services/api/onBreak.ts` — `markOnBreak`, `endBreak`, plus `OPEN_ENDED_BREAK_DATE` constant.
- [x] 3.3 Sync engine ops: deferred. Both follow-up writes and on-break mutations call their RPCs directly. The on-break path writes into the local `persons` mirror via `upsertPersons` so the profile reflects the new state immediately. Full queue integration is out of scope — follow-up logging is low-volume and on_break is a near-instant admin action; both align with the prior change's `getAlertConfig` pattern. Logged for a future change if true offline support becomes a requirement.

## 4. Screens

- [x] 4.1 `app/(app)/persons/[id]/follow-up.tsx` modal sheet — form: action chip-row, notes, status chips, snooze date input when status='snoozed'.
- [x] 4.2 Auto-open on `?openFollowUp=true` query param of profile route (forwards once to `/persons/[id]/follow-up`).
- [x] 4.3 `app/(app)/persons/[id]/on-break.tsx` modal sheet — date input + open-ended chip toggle.
- [x] 4.4 `app/(app)/follow-ups.tsx` — three-section list, pull to refresh, with empty state.
- [x] 4.5 Profile additions: "Log follow-up" button (any servant), "Mark on break" / "End break early" toggle (assigned servant or admin).

## 5. Notification router

- [x] 5.1 `absence_alert` → `/persons/[personId]?openFollowUp=true`.
- [x] 5.2 `welcome_back` → `/persons/[personId]`.

## 6. Translations

- [x] 6.1 `followUps.*` populated in EN/AR/DE: pendingTitle, modalTitle, sections.{needs_follow_up,snoozed_returning,recent}, action.{called,texted,visited,no_answer,other}, status.{completed,snoozed}, snoozeUntil, save, success, errorPermissionUpdate, errors.\*, alertSummary, needsFollowUpBadge.
- [x] 6.2 `persons.onBreak.*`: button, dialogTitle, untilLabel, fixedDate, openEnded, save, endBreak, success, errors.invalidDate. Plus `persons.followUp.button`.
- [x] 6.3 `notifications.types.welcome_back.title|body`: "Welcome back: {personName}", "Attended {eventTitle}." (DE/AR mirrored).

## 7. Tests

- [x] 7.1 Integration: `create_follow_up` succeeds for any servant; only creator can update within 1h; admin can SELECT all; non-creator non-admin cannot SELECT (`tests/follow-ups/rpcIntegration.test.ts`).
- [x] 7.2 Integration: `mark_on_break` sets status + paused_until; `compute_streak` skips events in window.
- [x] 7.3 Integration: `expire_breaks()` flips yesterday's expired breaks back to active.
- [x] 7.4 Integration: marking attendance for an alerted person sets `resolved_at` and dispatches `welcome_back`.
- [x] 7.5 Integration: only assigned servant receives `welcome_back` (no admin spam).
- [x] 7.6 Component: follow-up form validates action selection; snoozed requires date.
- [x] 7.7 Component: pending list renders three section headers + tiles.

## 8. Verification (in Expo Go)

- [x] 8.1 Trigger an absence alert from prior phase → tap banner → profile opens with follow-up modal pre-opened.
- [x] 8.2 Log "Texted" with note → save → modal closes; follow-up appears in `/follow-ups` "Recently logged".
- [x] 8.3 Mark a person on break (next 14 days) → run a counted-event detection cycle → person not flagged.
- [x] 8.4 Mark attendance for a previously-alerted person → welcome_back banner appears in assigned servant's app within seconds. Admin (different account) does NOT receive it.
- [x] 8.5 Snooze a follow-up to tomorrow → list shows it under "Returning today/tomorrow" the next day.
- [x] 8.6 End a break early via profile → person resumes detection (verify alert if streak ≥ threshold).
- [x] 8.7 Switch to AR → follow-up labels render correctly.
- [x] 8.8 `openspec validate add-followups-and-on-break` passes.
