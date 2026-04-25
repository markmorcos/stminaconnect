## Why

Alerts without a workflow are noise. Servants need to log what they did about an alerted person (called, texted, visited, no answer), capture context, and either close it or snooze it. The "On Break" status accommodates traveling members so they don't generate noise. And when an alerted member returns, a "Welcome back" notification closes the loop.

## What Changes

- **ADDED** capability `follow-up`.
- **ADDED** `follow_ups` table:
  - `id`, `person_id`, `created_by` (servant), `action` enum (`called` | `texted` | `visited` | `no_answer` | `other`), `notes`, `status` enum (`completed` | `snoozed`), `snooze_until` date nullable, `created_at`, `updated_at`.
  - References absence_alerts indirectly via `person_id` (no FK; one alert can yield multiple follow-ups across time).
- **ADDED** Follow-up flow: from notification banner / inbox / person profile → "Log follow-up" button → form (action picker, notes, status, optional snooze date) → save.
- **ADDED** `on_break` lifecycle:
  - "Mark on break" button on person profile (admin or assigned servant), accepts a `paused_until` date (or "Open ended").
  - Setting `status='on_break'` sets `paused_until` accordingly.
  - When `paused_until` passes (date < today), the daily cron auto-flips back to `status='active'` and re-runs detection.
- **ADDED** Return detection: when attendance is recorded for a person whose latest unresolved `absence_alerts` has `resolved_at IS NULL`, mark resolved + dispatch `welcome_back` notification per Open Question D2 (assigned servant only).
- **ADDED** Pending follow-ups list `app/(app)/follow-ups.tsx` with sections: Active alerts (with no follow-up yet), Snoozed (returning today/tomorrow), Recently logged (last 14 days).
- **ADDED** Notification router updates: `absence_alert` deep-link now goes to `/persons/[personId]?openFollowUp=true` (auto-opens follow-up form). `welcome_back` deep-links to `/persons/[personId]`.
- **ADDED** Translation keys for `followUps.*`, `persons.onBreak.*`, populated `notifications.types.welcome_back.*`.

## Impact

- **Affected specs**: `follow-up` (new), `notifications` (modified — `welcome_back` payload populated). `absence-detection` is touched indirectly via the `resolved_at` field and return detection.
- **Affected code**: `supabase/migrations/020_follow_ups.sql`, `021_on_break_helpers.sql`, `022_return_detection.sql`. New `app/(app)/follow-ups.tsx`, `app/(app)/persons/[id]/follow-up.tsx`, `app/(app)/persons/[id]/on-break.tsx`. Service modules added.
- **Breaking changes**: none.
- **Migration needs**: three migrations + cron schedule for break-expiry.
- **Expo Go compatible**: yes.
- **Uses design system**: all UI built with components/tokens from the design-system capability. No ad-hoc styles.
- **Dependencies**: `add-absence-detection`, `add-notification-service-mock`.
