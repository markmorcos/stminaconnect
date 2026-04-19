## Context

All the data exists. This change is 80% UI + aggregation RPC work. The interesting decisions are about what aggregates matter and how to keep them fast.

## Goals

- Dashboard loads fully in < 1 second on 4G for our data volumes.
- Charts are readable in all three languages (RTL for Arabic, axis numerals correct).
- At-Risk list is actionable — admin can tap into a follow-up or reassign immediately.
- Manage Servants is the admin's self-service for operational changes.

## Non-Goals

- No exports (CSV/PDF). Post-v1 feature.
- No date-range picker on charts; fixed 8–12 weeks windows for v1.
- No segment filters (e.g., "attendance trend for Arabic-speaking only"). Post-v1.

## Decisions

1. **Server-side aggregation via dedicated RPCs.** Clients request the aggregates they need; server returns pre-shaped JSON. Keeps chart payloads small and avoids shipping raw data.

2. **Victory Native for charts.** Lightweight; RN-first; supports RTL axes. Alternative was `react-native-svg-charts` (unmaintained).

3. **At-Risk list grouped by servant.** Each row shows the servant's name, open-alert count, and expandable list of members. Admin can tap a member to open the follow-up flow or reassign.

4. **Newcomer funnel is a simple count, not a cohort analysis.** "X new, Y became active, Z went inactive" over last 90 days. Cohort tracking is out of scope.

5. **Region breakdown uses `region` as the grouping key**, with a single "Unspecified" bucket for nulls. Top 10 regions by count, with "Other" rolled up.

6. **Home screen dispatches on role.** Rather than a separate `/admin-dashboard` route, the Home tab's root renders the admin dashboard when role=admin, otherwise the servant-focused home (from earlier changes). This keeps navigation simple.

7. **Manage Servants** is a dedicated route `/manage-servants`, not a tab. Entered via the admin dashboard.

## Risks / Trade-offs

- **Risk:** Aggregates could get slow if member/attendance tables grow. Indexes on `attendance(event_id)`, `attendance(person_id, event_id)`, `absence_alerts(status)` keep us fast. At our scale, not an issue.
- **Trade-off:** Fixed chart windows limit exploration. Acceptable for v1.

## Open Questions

See `_open-questions.md` #9 (unassigned state for deactivated servants' members). Manage Servants surface the unassigned queue.
