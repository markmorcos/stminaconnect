# Tasks — add-absence-detection

> **Migration numbering note**: the proposal targeted 017/018/019, but
> `017_sync_rpcs.sql` was claimed by the offline-sync change first. This
> change shifts to **018/019/020**. Functional content is unchanged.

## 1. Schema

- [x] 1.1 `018_alert_config.sql`: alert_config singleton table with default seed row; trigger to prevent multiple rows.
- [x] 1.2 `019_absence_alerts.sql`: absence_alerts table per design + indexes; unique on `(person_id, threshold_kind, last_event_id)`.

## 2. Detection logic

- [x] 2.1 `020_detect_absences.sql`: SQL function `compute_streak(person_id uuid, at timestamptz default now()) returns int` walking counted events backward.
- [x] 2.2 `020_detect_absences.sql`: SQL function `detect_absences(person_ids uuid[] default null)`:
  - For each person (or all eligible if null), compute streak.
  - Apply per-priority threshold (or fallback).
  - For new crossings, insert into `absence_alerts` and dispatch notifications.
- [x] 2.3 Wire `detect_absences` into the post-commit step of `mark_attendance` / `unmark_attendance` (call with affected person ids).
- [x] 2.4 Wire `detect_absences(null)` into pattern upsert/delete RPCs (full recompute).
- [x] 2.5 `pg_cron` schedule: hourly `select detect_absences(null);`.

## 3. Edge function (manual trigger + cron alternative)

- [x] 3.1 `supabase/functions/detect-absences/index.ts`: simply calls the SQL function. Useful for manual replays.

## 4. Admin alerts settings

- [x] 4.1 `app/(app)/admin/alerts.tsx`:
  - Form for global threshold (number), per-priority thresholds (4 number fields, each nullable with "use global"), notify_admin checkbox, escalation_threshold (nullable).
  - "Save" calls `update_alert_config`.
  - "Recalculate now" calls `recalculate_absences()` (admin-only RPC wrapping `detect_absences(null)`).

## 5. Mobile API

- [x] 5.1 `src/services/api/alertConfig.ts`: `getAlertConfig`, `updateAlertConfig`, `recalculateAbsences`.

## 6. Notification router

- [x] 6.1 Update `src/services/notifications/notificationRouter.ts`: map `absence_alert` → `/persons/[payload.personId]`.

## 7. Translations

- [x] 7.1 Populate `notifications.types.absence_alert.*`:
  - `title`: "Absence alert: {personName}"
  - `body`: "{consecutiveMisses} consecutive missed events. Last: {lastEventTitle}."
- [x] 7.2 `admin.alerts.*`:
  - `title`, `globalThreshold`, `priorityThresholds.{high,medium,low,very_low}`, `useGlobal`, `notifyAdmin`, `escalationThreshold`, `save`, `recalculate`, `success`.

## 8. Tests

- [x] 8.1 Unit (PG): `compute_streak` returns 0 when person attended last counted event.
- [x] 8.2 Unit: `compute_streak` returns N when person missed the last N counted events.
- [x] 8.3 Unit: `compute_streak` ignores non-counted events.
- [x] 8.4 Unit: streak ignores events during a break (`paused_until > event.start_at`).
- [x] 8.5 Integration: marking attendance for a previously-flagged person, then unmarking, fires no duplicate alert.
- [x] 8.6 Integration: priority `high` with threshold 2 fires after 2 misses; priority `medium` with global threshold 3 fires after 3.
- [x] 8.7 Integration: escalation threshold fires only after primary already fired and streak crosses higher.
- [x] 8.8 Integration: notification of type `absence_alert` lands in the assigned servant's inbox.
- [x] 8.9 Integration: `notify_admin_on_alert=true` produces additional notifications for admins.
- [x] 8.10 Component: admin alerts form persists changes; recalculate button calls RPC.

## 9. Verification (in Expo Go)

- [x] 9.1 Seed: ensure 5 counted events in the past 5 weeks; pick a seeded person assigned to the signed-in admin; have that person attend none of them.
- [x] 9.2 Set global threshold to 3; recalculate → an `absence_alert` notification appears in inbox + banner.
- [x] 9.3 Set the person's priority to `high` and per-priority threshold to 2 → recalculate → if not already escalated, an alert fires (or stays as before since unique constraint).
- [x] 9.4 Mark the person present at the most recent event → recalculate → no new alert (streak reset).
- [x] 9.5 Mark them absent again past threshold → new alert (different `last_event_id`).
- [x] 9.6 With `notify_admin_on_alert=true`, additional notifications appear in admin's inbox.
- [x] 9.7 `openspec validate add-absence-detection` passes.

## 10. Scope expansions discovered during verification

These items emerged while verifying §9 on-device. They are bundled into
this change because they are functionally inseparable from the absence
detection feature working end-to-end. Each is mirrored in the spec
deltas (sections 10/11 of `specs/absence-detection/spec.md` and the new
MODIFIED requirements in `specs/attendance/spec.md`).

- [x] 10.1 Cold-start filter: `compute_streak` ignores events older than the person's `registered_at` (021_compute_streak_cold_start.sql).
- [x] 10.2 Grace period (`alert_config.grace_period_days`, default 3): events within the grace window are invisible to the streak walk, AND `is_event_within_edit_window` extends its cutoff by the same window so servants can still backfill (022, 023).
- [x] 10.3 Check-in picker (`/attendance`) shows events from the past `grace_period_days` so backfill is reachable from the UI; renamed to "Recent events".
- [x] 10.4 Local-side edit-window check honors `graceDays` so the roster matches server semantics.
- [x] 10.5 Backfill grace field on the admin alerts settings screen, with i18n in EN/AR/DE and validation (≥ 0).
- [x] 10.6 `getPerson` Supabase RPC fallback so `absence_alert` deep links resolve before the SyncEngine has pulled the row; result is cached locally for subsequent reads (`person-management` spec delta).
- [x] 10.7 Read-only `/dev/db` SQLite inspector + destructive "Wipe local DB" action that resets local caches but preserves auth (`dev-tooling` spec delta). Gated by `__DEV__` or `EXPO_PUBLIC_SHOW_DEV_TOOLS=true`.
- [x] 10.8 Full Registration form Assigned Servant picker always synthesizes an option for the bound value (and the caller) so it never renders blank (`registration` spec delta).
