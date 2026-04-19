## 1. Aggregation RPCs

- [ ] 1.1 Migration `023_dashboard_rpcs.sql`:
  - `dashboard_overview()` returns counts: total, new_this_month, active, inactive, open_alerts, open_follow_ups, on_break
  - `dashboard_attendance_trend(weeks int default 10)` returns `[{ week_start, total_attended, counted_event_count }, ...]`
  - `dashboard_at_risk()` returns `[{ servant_id, servant_name, alerts: [...] }, ...]`
  - `dashboard_newcomer_funnel(days int default 90)` returns `{ new_count, became_active, went_inactive }`
  - `dashboard_region_breakdown()` returns `[{ region, count }, ...]` with top 10 + "Other"
- [ ] 1.2 RLS: all admin-only (verify via `profiles.role = 'admin'`)
- [ ] 1.3 Unit tests for each RPC with varied data shapes

## 2. Admin Home

- [ ] 2.1 `app/(tabs)/index.tsx`: branch on role; render `<AdminDashboard />` for admin
- [ ] 2.2 Overview cards component using `dashboard_overview`
- [ ] 2.3 Attendance trend chart with Victory Native
- [ ] 2.4 At-Risk list (collapsible by servant)
- [ ] 2.5 Newcomer funnel visual (3 numbers with arrows)
- [ ] 2.6 Region breakdown chart (horizontal bar)
- [ ] 2.7 Pull-to-refresh re-fetches all aggregates

## 3. Manage Servants

- [ ] 3.1 Route `/manage-servants` (admin only)
- [ ] 3.2 List servants with avatar, name, email, active state, assigned_count
- [ ] 3.3 Row actions: Invite new (modal), Deactivate (with unassigned queue handling), Reassign-all (picker)
- [ ] 3.4 Unassigned queue banner at top: "N members need reassignment" → tapping opens a picker flow
- [ ] 3.5 i18n for all strings

## 4. Tests

- [ ] 4.1 Unit: role-aware home dispatches correctly
- [ ] 4.2 Integration: RPC results match hand-computed values on seed data
- [ ] 4.3 RTL snapshot: Arabic layout for admin dashboard
- [ ] 4.4 Manage servants: invite flow + deactivate flow

## 5. Verification

- [ ] 5.1 Manual: admin sees the full dashboard; numbers match reality
- [ ] 5.2 Manual: deactivating a servant with assigned members creates an unassigned queue; reassigning clears it
- [ ] 5.3 Manual: switch to Arabic; charts and labels render correctly
- [ ] 5.4 `make test`, `make lint`, `make typecheck` pass
- [ ] 5.5 `openspec validate add-admin-dashboard` passes
- [ ] 5.6 Every scenario in `specs/admin-dashboard/spec.md`
