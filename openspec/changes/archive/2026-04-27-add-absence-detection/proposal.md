## Why

Tracking attendance is half the picture; the pastoral value emerges when the app detects extended absences and flags them for follow-up. We compute consecutive-miss streaks from counted events, evaluate them against admin-configured thresholds, and dispatch alerts via the existing `NotificationService` (still mock — the abstraction lets us focus on the detection logic).

## What Changes

- **ADDED** capability `absence-detection`.
- **ADDED** `alert_config` table (singleton):
  - `absence_threshold` (int, default 3),
  - `priority_thresholds` (jsonb, e.g. `{"high": 2, "medium": 3, "low": 4, "very_low": 6}` — null per-priority falls back to the global threshold),
  - `notify_admin_on_alert` (boolean default true),
  - `escalation_threshold` (int nullable; if set, secondary alert fires when streak crosses this; resolves Open Question D1).
- **ADDED** Admin settings screen `app/(app)/admin/alerts.tsx` for editing alert config.
- **ADDED** `absence_alerts` table tracking which (person, streak crossing) pairs have already been notified, to prevent duplicate alerts.
- **ADDED** `detect-absences` Edge Function:
  - Computes streaks for all persons (excluding `on_break`, `inactive`, soft-deleted) over counted events.
  - Compares streak to applicable threshold (priority-specific or global).
  - For new crossings: inserts into `absence_alerts` and dispatches a notification of type `'absence_alert'` to the assigned servant (and admins if configured).
  - For escalations: same but on the higher threshold.
  - For returns (streak reset to 0 from non-zero): handled in phase 12.
- **ADDED** Trigger or scheduled invocation: function runs after each `mark_attendance`/`unmark_attendance` op, AND on a `pg_cron` schedule every hour as a safety net.
- **ADDED** RPC `recalculate_absences()` admin-only — manual trigger.
- **ADDED** Notifications type `'absence_alert'` payload schema:
  - `personId`, `personName`, `consecutiveMisses`, `lastEventTitle`, `lastEventDate`.
- **ADDED** Translation keys `notifications.types.absence_alert.*` (now populated with real strings) and `admin.alerts.*`.

## Impact

- **Affected specs**:
  - `absence-detection` (new)
  - `notifications` (modified — `absence_alert` type now produces actual content)
  - `attendance` (modified — edit window honors `alert_config.grace_period_days`; check-in picker surfaces events from the past `grace_period_days`)
  - `person-management` (modified — `getPerson` falls back to the `get_person` RPC on local cache miss so notification deep links resolve before the SyncEngine has pulled the row)
  - `dev-tooling` (added requirements — read-only `/dev/db` SQLite inspector, plus a "Wipe local DB" action with confirmation)
  - `registration` (modified — Full Registration form's Assigned Servant picker always synthesizes an option for the bound value so the field never renders blank)
- **Affected code**: migrations `018_alert_config.sql`, `019_absence_alerts.sql`, `020_detect_absences.sql`, `021_compute_streak_cold_start.sql`, `022_grace_period.sql`, `023_edit_window_grace.sql`. New `supabase/functions/detect-absences/index.ts`. New `app/(app)/admin/alerts.tsx`, `app/(app)/dev/db.tsx`, `src/features/admin/AlertsScreen.tsx`, `src/features/dev/DbInspectorScreen.tsx`, `src/services/api/alertConfig.ts`. Updates to `src/services/api/attendance.ts`, `src/services/api/events.ts`, `src/services/api/persons.ts`, `src/services/db/database.ts`, `src/services/db/repositories/eventsRepo.ts`, `src/features/attendance/RosterScreen.tsx`, `src/features/registration/full/FullRegistrationForm.tsx`, `app/(app)/attendance/index.tsx`.
- **Breaking changes**: none.
- **Migration numbering note**: the proposal originally targeted 017/018/019; 017 was claimed by the offline-sync change, so this change occupies 018–023. The §10 "scope expansions" tasks document the rest.
- **Migration needs**: six migrations. `alert_config` seeded with defaults including `grace_period_days = 3`.
- **Expo Go compatible**: yes — server-side detection; client only consumes notifications.
- **Uses design system**: yes — the admin alerts settings screen and DB inspector use design-system tokens and components.
- **Dependencies**: `add-attendance-online-only`, `add-google-calendar-sync`, `add-notification-service-mock`, `add-offline-sync-with-sqlite`.
