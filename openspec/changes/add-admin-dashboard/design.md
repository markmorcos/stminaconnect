## Context

By this phase, all underlying data — persons, attendance, alerts, follow-ups — is in place. The dashboard is read-only aggregation. The architectural decisions are around chart library choice, how aggressively we cache aggregations, and how much we lean on server vs. client computation.

## Goals

- Admin sees the most important metrics on first load.
- Charts are readable on a phone screen.
- Each section's data fetches independently so a slow section doesn't block others.
- Numbers are correct and reproducible (servants and admins should agree).
- Trilingual rendering of all labels and numbers.

## Non-Goals

- Servant performance tracking (deferred — explicitly out of v1 per the original prompt).
- Drill-down filters (e.g. "show only region X"). v1 dashboard is fixed.
- Custom date ranges. Fixed windows: 30 days, 4 weeks, 8–12 weeks, 90 days.
- Export (CSV, PDF). Out of v1.
- Real-time auto-refresh. Pull-to-refresh and manual reload only.

## Decisions

1. **Chart library**: `react-native-chart-kit` chosen over `victory-native`:
   - `chart-kit` works in Expo Go without native modules; `victory-native` 36+ requires `react-native-skia` which needs a dev build for some features.
   - Slightly less polished but adequate for the data densities here.
   - We pin `react-native-chart-kit ^6.x`.
2. **Aggregation on server**: each card/chart maps to one RPC. Reasoning: keeps the mobile app simple, and we can cache results per RPC. Local cache only gets the aggregated payload, not raw rows.
3. **Caching**: TanStack Query stale-time 5 minutes per RPC; pull-to-refresh invalidates. Local SQLite is NOT used for aggregations (they're recomputable; not worth the schema overhead).
4. **Overview cards**:
   - Total members = count where `deleted_at IS NULL`.
   - Active in last 30 days = distinct persons with attendance row in the last 30 days at counted events.
   - New this month = persons where `registered_at >= start of current month (Berlin)`.
   - Avg counted-event attendance (rolling 4 weeks) = total attendance rows at counted events in last 4 weeks / number of counted events in same window.
5. **Attendance trend**: line chart with one point per counted event in the last 8–12 weeks. x-axis tick labels show abbreviated date. Tooltips not supported by chart-kit; we render the most recent value as a number above the chart.
6. **At-risk list**: groups persons with `absence_alerts.resolved_at IS NULL` by assigned servant. Each row shows person name, streak, last event date. Tapping opens profile. Limit to 50 across groups.
7. **Newcomer funnel**: stacked horizontal bars over 90 days:
   - Quick Add count (registration_type='quick_add').
   - Of those, Upgraded to Full count.
   - Of those, "Active" count (attended at least one counted event in the last 30 days).
   - Conversion rate displayed as percentages.
8. **Region breakdown**: horizontal bar chart, top 8 regions by member count + "Other". Empty regions excluded.
9. **Admin landing routing**: in `app/(app)/_layout.tsx`, after the auth check, if `servant.role === 'admin'` and current route is `/`, redirect to `/admin/dashboard`. Keep `/` accessible (admin can still navigate back if desired).
10. **Servants management screen** (Open Question A1): admin can:
    - Invite a new servant (magic-link based) — RPC `invite_servant(email, displayName, role)` is `SECURITY DEFINER`, creates `auth.users` via service-role-equivalent operation, inserts into `servants`, and triggers a magic link email.
    - Promote/demote role (admin-only RPC `update_servant_role`).
    - Deactivate (set `deactivated_at`); deactivated servants cannot sign in (deactivation enforcement migrated into auth flow as part of this change).
11. **Deactivation enforcement** (resolves a small loose end from phase 2): `get_my_servant()` returns null if `deactivated_at IS NOT NULL`, forcing sign-out.
12. **Locale-aware number formatting** (Open Question E2): use `Intl.NumberFormat(i18n.language, ...)` for all numbers in cards/charts. Phone numbers and IDs unaffected.

## Risks / Trade-offs

- **Risk**: chart-kit lacks a tooltip mechanism. Mitigation: above-chart "current value" labels.
- **Risk**: aggregation RPCs are heavy on small Postgres free-tier. With <200 persons + small attendance rowcount, fine.
- **Trade-off**: not implementing CSV export. Phase 18 runbook documents Supabase Dashboard as the export path until v2.
- **Risk**: `invite_servant` requires service-role privileges to create auth users. Implemented as Edge Function rather than SQL RPC — Edge Function uses the service role key.

## Migration Plan

- Two migrations + one Edge Function (`invite-servant`).
- Existing servants unaffected.

## Open Questions

- **A1, E2** resolved.
