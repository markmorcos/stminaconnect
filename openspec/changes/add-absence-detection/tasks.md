# Tasks — add-absence-detection

## 1. Schema

- [ ] 1.1 `017_alert_config.sql`: alert_config singleton table with default seed row; trigger to prevent multiple rows.
- [ ] 1.2 `018_absence_alerts.sql`: absence_alerts table per design + indexes; unique on `(person_id, threshold_kind, last_event_id)`.

## 2. Detection logic

- [ ] 2.1 `019_detect_absences.sql`: SQL function `compute_streak(person_id uuid, at timestamptz default now()) returns int` walking counted events backward.
- [ ] 2.2 `019_detect_absences.sql`: SQL function `detect_absences(person_ids uuid[] default null)`:
  - For each person (or all eligible if null), compute streak.
  - Apply per-priority threshold (or fallback).
  - For new crossings, insert into `absence_alerts` and dispatch notifications.
- [ ] 2.3 Wire `detect_absences` into the post-commit step of `mark_attendance` / `unmark_attendance` (call with affected person ids).
- [ ] 2.4 Wire `detect_absences(null)` into pattern upsert/delete RPCs (full recompute).
- [ ] 2.5 `pg_cron` schedule: hourly `select detect_absences(null);`.

## 3. Edge function (manual trigger + cron alternative)

- [ ] 3.1 `supabase/functions/detect-absences/index.ts`: simply calls the SQL function. Useful for manual replays.

## 4. Admin alerts settings

- [ ] 4.1 `app/(app)/admin/alerts.tsx`:
  - Form for global threshold (number), per-priority thresholds (4 number fields, each nullable with "use global"), notify_admin checkbox, escalation_threshold (nullable).
  - "Save" calls `update_alert_config`.
  - "Recalculate now" calls `recalculate_absences()` (admin-only RPC wrapping `detect_absences(null)`).

## 5. Mobile API

- [ ] 5.1 `src/services/api/alertConfig.ts`: `getAlertConfig`, `updateAlertConfig`, `recalculateAbsences`.

## 6. Notification router

- [ ] 6.1 Update `src/services/notifications/notificationRouter.ts`: map `absence_alert` → `/persons/[payload.personId]`.

## 7. Translations

- [ ] 7.1 Populate `notifications.types.absence_alert.*`:
  - `title`: "Absence alert: {personName}"
  - `body`: "{consecutiveMisses} consecutive missed events. Last: {lastEventTitle}."
- [ ] 7.2 `admin.alerts.*`:
  - `title`, `globalThreshold`, `priorityThresholds.{high,medium,low,very_low}`, `useGlobal`, `notifyAdmin`, `escalationThreshold`, `save`, `recalculate`, `success`.

## 8. Tests

- [ ] 8.1 Unit (PG): `compute_streak` returns 0 when person attended last counted event.
- [ ] 8.2 Unit: `compute_streak` returns N when person missed the last N counted events.
- [ ] 8.3 Unit: `compute_streak` ignores non-counted events.
- [ ] 8.4 Unit: streak ignores events during a break (`paused_until > event.start_at`).
- [ ] 8.5 Integration: marking attendance for a previously-flagged person, then unmarking, fires no duplicate alert.
- [ ] 8.6 Integration: priority `high` with threshold 2 fires after 2 misses; priority `medium` with global threshold 3 fires after 3.
- [ ] 8.7 Integration: escalation threshold fires only after primary already fired and streak crosses higher.
- [ ] 8.8 Integration: notification of type `absence_alert` lands in the assigned servant's inbox.
- [ ] 8.9 Integration: `notify_admin_on_alert=true` produces additional notifications for admins.
- [ ] 8.10 Component: admin alerts form persists changes; recalculate button calls RPC.

## 9. Verification (in Expo Go)

- [ ] 9.1 Seed: ensure 5 counted events in the past 5 weeks; pick a seeded person assigned to the signed-in admin; have that person attend none of them.
- [ ] 9.2 Set global threshold to 3; recalculate → an `absence_alert` notification appears in inbox + banner.
- [ ] 9.3 Set the person's priority to `high` and per-priority threshold to 2 → recalculate → if not already escalated, an alert fires (or stays as before since unique constraint).
- [ ] 9.4 Mark the person present at the most recent event → recalculate → no new alert (streak reset).
- [ ] 9.5 Mark them absent again past threshold → new alert (different `last_event_id`).
- [ ] 9.6 With `notify_admin_on_alert=true`, additional notifications appear in admin's inbox.
- [ ] 9.7 `openspec validate add-absence-detection` passes.
