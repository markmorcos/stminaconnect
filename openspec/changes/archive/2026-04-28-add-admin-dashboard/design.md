## Context

By this phase, all underlying data — persons, attendance, alerts, follow-ups — is in place. The dashboard is read-only aggregation. The architectural decisions are around chart library choice, how aggressively we cache aggregations, and how much we lean on server vs. client computation.

The change also folds in a **navigation shell refactor**. The home-screen header overflow menu has reached 8+ items (About, Settings, Account, Pending follow-ups, Counted Events, Alerts, DB Inspector, Sign Out) and Phase 17 (`add-servant-dashboard`) plus this phase's new admin pages would push it further. Rather than ship the dashboard as a separate `/admin/dashboard` URL behind yet another menu item, we move primary nav to a bottom tab bar and consolidate user-facing menu items into a Settings tab. The kebab survives only as a dev-tools host, vanishing in production.

## Goals

- Admin sees the most important metrics on first load.
- Charts are readable on a phone screen.
- Each section's data fetches independently so a slow section doesn't block others.
- Numbers are correct and reproducible (servants and admins should agree).
- Trilingual rendering of all labels and numbers.
- Primary navigation is a bottom tab bar (Home / Persons / Follow-ups / Settings) used by both roles, with Home tab content branching on role.
- The header carries the bell + (dev-only) kebab; no user-facing items in the kebab.

## Non-Goals

- Servant performance tracking (deferred — explicitly out of v1 per the original prompt).
- Drill-down filters (e.g. "show only region X"). v1 dashboard is fixed.
- Custom date ranges. Fixed windows: 30 days, 4 weeks, 8–12 weeks, 90 days.
- Export (CSV, PDF). Out of v1.
- Real-time auto-refresh. Pull-to-refresh and manual reload only.
- Reordering or hiding tabs by role. The four tabs are identical for both roles in v1; only Home content varies.
- Drawer navigation, hamburger menus, or per-role tab sets — all rejected to keep the shell predictable.

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
9. **Role-aware Home tab, no redirect**: rather than introduce `/admin/dashboard` as a separate URL with a redirect at the layout level, `app/(app)/index.tsx` branches on `servant.role` and renders either `<AdminDashboard />` or the existing launcher (Phase 17 swaps the launcher for `<ServantHome />`). Reasoning: keeps URLs stable across roles, avoids the brief flash of `/` before the redirect, and means a role change is reflected by component re-render rather than a navigation event. The dashboard component still lives in its own module (`src/features/admin-dashboard/AdminDashboard.tsx`) — only the route file is shared.
10. **Bottom tab navigation via Expo Router**: introduce `app/(app)/(tabs)/_layout.tsx` using Expo Router's `Tabs`. The four root routes (`/`, `/persons`, `/follow-ups`, `/settings`) live under `(tabs)`. Sub-routes (registration, attendance, notifications, settings sub-pages, admin sub-pages, person profile, dev tools) live outside `(tabs)` so the tab bar hides automatically. Existing `app/(app)/follow-ups.tsx` moves into `(tabs)/`; `persons/index.tsx` is reachable via the Persons tab; the Settings tab landing is new (`(tabs)/settings.tsx`). The Account, Language, About, and Admin sub-pages keep their current URLs (`/settings/account`, `/settings/language`, `/about`, `/admin/*`), reached by tapping rows in the Settings landing.
11. **Settings landing structure**: a single `SettingsList` screen, sectioned via the design-system `Stack` + `Card` primitives. App section first (Account, Language, About), then — only when `servant.role === 'admin'` — an Admin section (Counted Events, Alert thresholds, Servants), then a divider and Sign Out styled with `tokens.colors.danger` (or equivalent destructive token). Sign Out routes through `useSignOutWithGuard` so the existing pending-writes confirmation still fires.
12. **Header on every root tab**: a shared `<TabHeader title={...} />` component renders title + bell (with `notificationsStore.unreadCount` badge) + dev-only overflow menu. Implemented as a shared component imported by each of the four tab screens rather than a `Tabs` `screenOptions.header` prop, because the header content is identical across tabs and we want each tab to drive its own title with i18n. The overflow renders `null` outside dev so production builds do not show an empty kebab.
13. **Servants management screen** (Open Question A1): admin can:
    - Invite a new servant (magic-link based) — Edge Function `invite-servant` uses the service role to call `supabase.auth.admin.inviteUserByEmail` and insert into `servants`. Server-side authorization checks the caller's JWT for `is_admin()`.
    - Promote/demote role (admin-only RPC `update_servant_role`).
    - Deactivate (set `deactivated_at`); deactivated servants cannot sign in (deactivation enforcement migrated into auth flow as part of this change).
14. **Deactivation enforcement** (resolves a small loose end from phase 2): `get_my_servant()` returns null if `deactivated_at IS NOT NULL`, forcing sign-out.
15. **Locale-aware number formatting** (Open Question E2): use `Intl.NumberFormat(i18n.language, ...)` for all numbers in cards/charts. Phone numbers and IDs unaffected.

## Risks / Trade-offs

- **Risk**: chart-kit lacks a tooltip mechanism. Mitigation: above-chart "current value" labels.
- **Risk**: aggregation RPCs are heavy on small Postgres free-tier. With <200 persons + small attendance rowcount, fine.
- **Trade-off**: not implementing CSV export. Phase 18 runbook documents Supabase Dashboard as the export path until v2.
- **Risk**: `invite_servant` requires service-role privileges to create auth users. Implemented as Edge Function rather than SQL RPC — Edge Function uses the service role key.
- **Trade-off**: bundling the navigation refactor into the dashboard change makes this PR larger. Mitigation: scoped tasks list, both pieces are independently testable, and shipping them together avoids a second URL juggle (deleting `/admin/dashboard` later if we built it now).
- **Trade-off**: Sign Out is one extra tap (Settings → Sign Out) vs. the previous kebab. Acceptable: it's the standard iOS/Android location and reduces accidental taps.
- **Trade-off**: Follow-ups is a tab for both roles even though it's a personal todo for servants and an oversight view for admins. Same surface, different mental model — splitting later (e.g., admin "All follow-ups" view) is additive.

## Migration Plan

- Two SQL migrations + one Edge Function (`invite-servant`).
- One mobile-shell refactor: introduce `(tabs)` group, move `follow-ups.tsx`, add Settings landing, replace home header. No URL changes for users.
- Existing servants unaffected. Existing routes (`/persons`, `/follow-ups`, `/settings/account`, `/settings/language`, `/about`, `/admin/counted-events`, `/admin/alerts`) keep their URLs; only their navigation entry points change.

## Open Questions

- **A1, E2** resolved.
