## Why

The admin needs a single screen that summarizes engagement: how many members, how many newcomers this month, attendance trend over recent weeks, who's at risk, where new people are coming from. With all the data layers in place, the dashboard is mostly aggregation queries plus charts.

## What Changes

- **ADDED** capability `admin-dashboard`.
- **ADDED** `app/(app)/admin/dashboard.tsx` (default admin landing page after sign-in if `role='admin'`).
- **ADDED** Sections:
  1. **Overview cards**: Total members, Active in last 30 days, New this month, Avg counted-event attendance (rolling 4 weeks).
  2. **Attendance trend**: line chart, last 8–12 weeks, x = event date, y = attendees.
  3. **At-risk list**: persons with unresolved `absence_alerts`, grouped by assigned servant. Tap → person profile.
  4. **Newcomer funnel**: cards Quick Add → Full → Active (counts and conversion rates over last 90 days).
  5. **Region breakdown**: bar chart of member counts by region (top 8 + "Other").
- **ADDED** Server-side aggregation RPCs (one per section to keep the dashboard fast and uniform):
  - `dashboard_overview()`, `dashboard_attendance_trend(weeks int default 12)`, `dashboard_at_risk()`, `dashboard_newcomer_funnel(days int default 90)`, `dashboard_region_breakdown(top int default 8)`.
- **ADDED** `react-native-chart-kit` dependency (Expo Go compatible).
- **ADDED** Admin invite flow (resolves Open Question A1):
  - `app/(app)/admin/servants.tsx` listing all servants with role + active state, plus an "Invite servant" button.
  - Invite sends a magic link via Supabase Auth using a server RPC `invite_servant(email, displayName, role)` that creates the auth user and the `servants` row.
- **ADDED** Translation keys `admin.dashboard.*` and `admin.servants.*`.
- **MODIFIED** Default home routing: admins land on `/admin/dashboard`; servants land on the existing home tile screen.

## Impact

- **Affected specs**: `admin-dashboard` (new), `auth` (modified — admin landing route logic).
- **Affected code**: new admin screens, new aggregation RPCs `023_dashboard_rpcs.sql`, `024_invite_servant.sql`. Mobile API additions.
- **Breaking changes**: admin's first screen is now the dashboard, not the home tiles. Servants unaffected.
- **Migration needs**: two migrations.
- **Expo Go compatible**: yes — `react-native-chart-kit` runs in Expo Go.
- **Uses design system**: all UI built with components/tokens from the design-system capability. No ad-hoc styles. Charts inherit colors from `tokens.colors`.
- **Dependencies**: `add-absence-detection`, `add-followups-and-on-break`, `add-attendance-online-only`, `add-google-calendar-sync`, `add-offline-sync-with-sqlite`.
