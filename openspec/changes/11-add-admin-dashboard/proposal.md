## Why

Admins need quantitative visibility to evaluate engagement and identify at-risk members across the whole congregation. The operational data is now flowing (members, attendance, alerts, follow-ups); we aggregate it into a single dashboard.

## What Changes

- **ADDED** `admin-dashboard` capability:
  - Admin home (Home tab renders a different layout for role=admin): Overview cards (total members, new this month, active, inactive, open alerts, open follow-ups, on-break count).
  - Attendance trend line chart: counted-event attendance totals over the last 8–12 weeks.
  - At-Risk list: all open alerts grouped by assigned servant.
  - Newcomer Funnel: counts of `new` vs `active` over the last 90 days.
  - Region Breakdown: member counts by region (pie or bar).
  - Manage Servants screen (admin only): list of servants with count of assigned members, plus actions to invite, reassign-all, deactivate.
- **MODIFIED** `admin-dashboard`-adjacent RPCs: new `dashboard_overview()`, `dashboard_attendance_trend(weeks int)`, `dashboard_at_risk()`, `dashboard_newcomer_funnel()`, `dashboard_region_breakdown()`.

## Impact

- **Affected specs:** `admin-dashboard` (new)
- **Affected code (preview):**
  - Migration `023_dashboard_rpcs.sql`
  - Mobile: `app/(tabs)/index.tsx` (role-aware home), `features/admin-dashboard/*`, `app/manage-servants.tsx`
  - Charting: add `victory-native` dependency
  - i18n: dashboard + servants admin keys
- **Breaking changes:** Home screen layout changes based on role. Existing Home content (Welcome + Quick Add button) is preserved as the servant-role variant; admin gets a new layout.
- **Migration needs:** 1 migration for RPCs.
- **Depends on:** `add-push-and-followups`, `add-i18n-foundation`.
