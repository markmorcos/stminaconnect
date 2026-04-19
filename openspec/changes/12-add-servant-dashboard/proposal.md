## Why

Servants need a home surface that surfaces their daily work: who is their group, what follow-ups are pending, and which newcomers arrived recently. The earlier "Welcome, Name + Quick Add button" home was a placeholder. This change builds the real servant home.

## What Changes

- **ADDED** `servant-dashboard` capability:
  - My Group section: list of members assigned to the current servant, each showing name, status, priority, last-attendance relative time, and a streak-health indicator (green = within tolerance, yellow = 1 below threshold, red = at/above threshold).
  - Pending Follow-Ups card (links to the Follow-Ups tab).
  - Recent Newcomers card: persons the current servant registered in the last 30 days.
  - Quick Add button remains.
- Sorting controls on My Group: by name, last-attendance, priority.

## Impact

- **Affected specs:** `servant-dashboard` (new)
- **Affected code (preview):**
  - Migration `024_servant_dashboard_rpcs.sql`: `my_group()`, `my_recent_newcomers(days int)`, `my_open_follow_ups_count()`
  - Mobile: refactor `app/(tabs)/index.tsx` servant branch
  - i18n: servant-dashboard keys
- **Breaking changes:** servant home layout changes (formerly a placeholder, now full dashboard).
- **Migration needs:** 1 migration.
- **Depends on:** `add-admin-dashboard` (shared patterns), `add-push-and-followups`, `add-i18n-foundation`.
