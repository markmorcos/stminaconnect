## Why

The admin needs a single screen that summarizes engagement: how many members, how many newcomers this month, attendance trend over recent weeks, who's at risk, where new people are coming from. With all the data layers in place, the dashboard is mostly aggregation queries plus charts.

This change also folds in a navigation shell refactor that's been pending: the header overflow menu has grown to 8+ items and will only grow with this phase (Servants, dashboard) and the next (Servant Dashboard). Moving primary navigation into a bottom tab bar — and consolidating Account/Language/About/Sign Out/Admin into a single Settings tab — pre-empts that bloat and gives the admin's new dashboard a stable home tab instead of a separate URL.

## What Changes

### Admin dashboard

- **ADDED** capability `admin-dashboard`.
- **ADDED** Sections, in order:
  1. **Overview cards**: Total members, Active in last 30 days, New this month, Avg counted-event attendance (rolling 4 weeks).
  2. **Attendance trend**: line chart, last 8–12 weeks, x = event date, y = attendees.
  3. **At-risk list**: persons with unresolved `absence_alerts`, grouped by assigned servant. Tap → person profile.
  4. **Newcomer funnel**: cards Quick Add → Full → Active (counts and conversion rates over last 90 days).
  5. **Region breakdown**: bar chart of member counts by region (top 8 + "Other").
- **ADDED** Server-side aggregation RPCs (one per section to keep the dashboard fast and uniform):
  - `dashboard_overview()`, `dashboard_attendance_trend(weeks int default 12)`, `dashboard_at_risk()`, `dashboard_newcomer_funnel(days int default 90)`, `dashboard_region_breakdown(top int default 8)`.
- **ADDED** `react-native-chart-kit` dependency (Expo Go compatible).
- **ADDED** Admin invite & lifecycle (resolves Open Question A1):
  - `app/(app)/admin/servants.tsx` listing all servants with role + active state, plus an "Invite servant" button. Reached via Settings → Admin → Servants (no top-level admin tab).
  - Invite sends a magic link via Supabase Auth using an Edge Function `invite-servant` that creates the auth user and the `servants` row.
  - Admin RPCs `update_servant_role`, `deactivate_servant`, `reactivate_servant`.
- **ADDED** Translation keys `admin.dashboard.*` and `admin.servants.*`.

### App shell (navigation refactor folded in)

- **ADDED** capability `app-shell`.
- **ADDED** bottom tab bar at `app/(app)/(tabs)/_layout.tsx` with four tabs: Home, Persons, Follow-ups, Settings. The tab bar appears on root routes only; sub-routes (registration flows, attendance, notifications, settings sub-pages, admin sub-pages, dev tools, person profile) hide it.
- **MODIFIED** `app/(app)/index.tsx` (Home tab) to be role-aware: renders the admin dashboard for admins and the existing launcher tile screen for servants. Phase 17 (`add-servant-dashboard`) replaces the launcher with the servant dashboard. Selection happens inside the Home component — no `Redirect`, URL stays `/` for both roles.
- **MODIFIED** `app/(app)/(tabs)/settings.tsx` (Settings tab) is a sectioned landing screen consolidating:
  - App: Account → `/settings/account`, Language → `/settings/language`, About → `/about`.
  - Admin (admins only): Counted Events → `/admin/counted-events`, Alert thresholds → `/admin/alerts`, Servants → `/admin/servants`.
  - A divider then Sign Out as a destructive action that triggers the existing `useSignOutWithGuard` flow.
- **MODIFIED** Header on every root tab renders title + notifications bell (with unread badge) + dev-only overflow menu. The overflow menu is rendered only when `__DEV__` or `EXPO_PUBLIC_SHOW_DEV_TOOLS=true` and contains only dev tools (DB Inspector, Showcase). In production builds the kebab disappears entirely.
- **REMOVED** All previous user-facing entries from the home header overflow menu (About, Settings, Account, Pending follow-ups, Counted Events, Alerts, Sign Out). Each is now reachable via the tab bar or Settings.
- **MODIFIED** Existing routes:
  - `app/(app)/follow-ups.tsx` becomes `app/(app)/(tabs)/follow-ups.tsx` (URL `/follow-ups` unchanged).
  - `app/(app)/persons/index.tsx` is reachable via the Persons tab (URL `/persons` unchanged).
  - `app/(app)/admin/_layout.tsx` keeps its Stack + role guard for `/admin/*` sub-routes; `dashboard.tsx` is NOT introduced here (the dashboard renders inline at `/`).
- **ADDED** Translation keys `tabs.*` (home, persons, followUps, settings) and `settings.section.*` (app, admin, signOut).

## Impact

- **Affected specs**: `admin-dashboard` (new), `app-shell` (new), `auth` (modified — deactivation enforcement only; the previous admin-landing-redirect requirement is dropped because the Home tab is role-aware in place).
- **Affected code**: new admin screens, new `(tabs)` layout group, restructured Settings landing, new aggregation RPCs `023_dashboard_rpcs.sql`, `024_admin_servant_rpcs.sql` plus `invite-servant` Edge Function. Mobile API additions.
- **Breaking changes**: home header is restructured and the kebab is dev-only. No URL changes for users.
- **Migration needs**: two SQL migrations + one Edge Function.
- **Expo Go compatible**: yes — `react-native-chart-kit` and Expo Router bottom tabs both run in Expo Go.
- **Uses design system**: all UI built with components/tokens from the design-system capability. No ad-hoc styles. Charts inherit colors from `tokens.colors`. Tab bar and Settings rows use existing primitives.
- **Dependencies**: `add-absence-detection`, `add-followups-and-on-break`, `add-attendance-online-only`, `add-google-calendar-sync`, `add-offline-sync-with-sqlite`.
