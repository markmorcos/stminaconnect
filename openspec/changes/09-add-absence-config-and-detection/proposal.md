## Why

Attendance data is now flowing. The product's differentiator is noticing when a member *stops* attending — this change implements the core of that. Admins configure thresholds; after every counted event, an Edge Function computes absence streaks and creates alert records. Notifications and follow-up UX are the next change; here we end with persisted alerts in a new `absence_alerts` table.

## What Changes

- **ADDED** `absence-detection` capability:
  - `absence_config` table (singleton row for the deployment): `default_threshold int`, `admin_gets_alerts boolean`, `alert_priority_thresholds jsonb` (e.g., `{ "high": 2, "medium": 3, "low": 4, "very_low": 6 }`).
  - `absence_alerts` table: `(id, person_id, assigned_servant_id, triggered_at, event_id_triggering, streak_length, status ('open'|'resolved'|'dismissed'), resolved_at)`.
  - Algorithm: after each counted event, for every active person with `priority` mapping to a threshold, compute consecutive missed counted events since their last attended counted event; if >= threshold and no existing `open` alert exists, create one.
  - `detect-absences` Edge Function invoked after each `calendar-sync` (if events changed) and on demand; can also be run after a manual attendance edit (less common).
  - Admin Settings screen: Absence Configuration — default threshold, per-priority overrides, admin-notifications toggle.
- This change stores alerts but does **not** send push notifications yet — that's the next change. The dashboard at-risk list (in `add-admin-dashboard`) will consume these alerts.

## Impact

- **Affected specs:** `absence-detection` (new), `settings` (MODIFIED — adds absence config section)
- **Affected code (preview):**
  - Migrations: `016_absence_config.sql`, `017_absence_alerts.sql`, `018_absence_rpcs.sql`
  - Edge Function: `supabase/functions/detect-absences/`
  - Mobile: `features/settings/screens/absence-config.tsx`, `services/api/absence.ts`
  - i18n: absence + settings keys
- **Breaking changes:** none.
- **Migration needs:** 3 migrations + default config row seeded.
- **Depends on:** `add-attendance-online`, `add-google-calendar-sync`, `add-person-data-model`, `add-i18n-foundation`. (Offline sync not required — this runs server-side.)
