## Why

Non-admin servants need a personal home view: who's in their group, who's slipping, what follow-ups they owe, and any new people from the past month. With the underlying data and aggregation patterns established in phase 13, the servant dashboard is straightforward.

## What Changes

- **ADDED** capability `servant-dashboard`.
- **MODIFIED** the existing tile-style home screen at `app/(app)/index.tsx` to be the servant dashboard:
  1. **Quick actions row**: Quick Add, Check In, Register full (compact tiles on top).
  2. **My Group**: list of assigned persons with last attendance + streak status (green/yellow/red).
  3. **Pending follow-ups**: link to `/follow-ups` with count badge; preview top 3 items.
  4. **Recent newcomers (30 days)**: list of newcomers (any servant) over last 30 days; tap → profile.
- **ADDED** Server-side RPCs:
  - `servant_my_group(servant_id default auth.uid())` returns assigned persons + last attendance + streak with status colour buckets.
  - `servant_pending_followups_count()` returns single int.
  - `servant_recent_newcomers(days int default 30)` returns recent persons.
- **ADDED** Streak status buckets (status colour rule):
  - Green: streak 0 (attended last counted event).
  - Yellow: 1 ≤ streak < threshold.
  - Red: streak ≥ threshold.
  - On break: grey "On break" chip instead of streak.
- **ADDED** Translation keys `home.servant.*` (which replaces the placeholder home keys).

## Impact

- **Affected specs**: `servant-dashboard` (new). `home` placeholder strings get repurposed.
- **Affected code**: heavy modification of `app/(app)/index.tsx`. New RPCs in `025_servant_dashboard_rpcs.sql`. Modified `src/services/api/dashboard.ts` (additions).
- **Breaking changes**: home screen is restructured, but only for non-admin servants (admins go to `/admin/dashboard`).
- **Migration needs**: one migration.
- **Expo Go compatible**: yes.
- **Uses design system**: all UI built with components/tokens from the design-system capability. No ad-hoc styles.
- **Dependencies**: `add-admin-dashboard`, `add-followups-and-on-break`, `add-absence-detection`.
