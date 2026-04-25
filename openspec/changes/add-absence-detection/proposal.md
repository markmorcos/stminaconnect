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

- **Affected specs**: `absence-detection` (new), `notifications` (modified — `absence_alert` type now produces actual content).
- **Affected code**: `supabase/migrations/017_alert_config.sql`, `018_absence_alerts.sql`. New `supabase/functions/detect-absences/index.ts`. New `app/(app)/admin/alerts.tsx`. New `src/services/api/alertConfig.ts`.
- **Breaking changes**: none.
- **Migration needs**: two migrations. `alert_config` seeded with defaults.
- **Expo Go compatible**: yes — server-side detection; client only consumes notifications.
- **Uses design system**: yes — the admin alerts settings screen uses design-system tokens and components.
- **Dependencies**: `add-attendance-online-only`, `add-google-calendar-sync`, `add-notification-service-mock`, `add-offline-sync-with-sqlite`.
