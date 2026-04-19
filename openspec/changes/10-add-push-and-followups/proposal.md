## Why

Alerts exist but are invisible and inactionable. This change makes them visible and actionable: (1) Expo push notifications to the assigned servant when an alert fires; (2) a Follow-Up screen for logging the servant's outreach action; (3) "On Break" state to pause alerts for a member; (4) Return Detection to auto-resolve alerts and notify servants when a flagged member attends again.

This is the feature that actually helps servants stay connected.

## What Changes

- **ADDED** `push-notifications` capability:
  - `push_tokens` table keyed to user; one token per device. Token registration runs on sign-in and on permission change.
  - `push-dispatch` Edge Function called when an alert fires or a return is detected. Sends via Expo Push API.
  - Deep links: tapping an absence push opens the follow-up entry screen for that person; tapping a return push opens the person profile with a "Welcome back" banner.
- **ADDED** `follow-up` capability:
  - `follow_ups` table: `(id, alert_id, action_type, notes, status, created_at, created_by)` — action_type enum `Called | Texted | Visited | NoAnswer | Other`; status `Completed | Snoozed`.
  - `persons.on_break` boolean + `on_break_until date` columns; when on break, detection skips the person until the date passes.
  - When a person attends a counted event while an `open` alert exists for them, the alert transitions to `resolved` and a "Return Detected" notification fires.
  - Mobile UI: Follow-Ups tab on home showing all open alerts for the current servant; tapping one opens the Log Follow-Up form; person detail gets an "On Break" toggle.
- **MODIFIED** `absence-detection` capability:
  - Detection skips persons with `on_break = true AND on_break_until > now()`.
  - When attendance is marked for a counted event for a person with `open` alert, resolves it and triggers return notification.

## Impact

- **Affected specs:** `push-notifications` (new), `follow-up` (new), `absence-detection` (MODIFIED), `person-management` (MODIFIED — on break toggle), `offline-sync` (MODIFIED — follow-up mutations queue offline)
- **Affected code (preview):**
  - Migrations: `019_push_tokens.sql`, `020_follow_ups.sql`, `021_on_break_columns.sql`, `022_absence_modified.sql`
  - Edge Function: `supabase/functions/push-dispatch/`
  - Mobile: `features/follow-up/*`, `services/notifications/*`, `app/follow-up/[alertId].tsx`, `app/(tabs)/follow-ups.tsx`, person detail on-break toggle
  - i18n: follow-up + notifications keys
- **Breaking changes:** none.
- **Migration needs:** 4 migrations.
- **Depends on:** `add-absence-config-and-detection`, `add-attendance-online`, `add-offline-sync`, `add-i18n-foundation`.
