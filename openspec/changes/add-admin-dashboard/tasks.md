# Tasks — add-admin-dashboard

## 1. Aggregation RPCs

- [ ] 1.1 `023_dashboard_rpcs.sql`:
  - `dashboard_overview()` returns single row with totalMembers, activeLast30, newThisMonth, avgAttendance4w.
  - `dashboard_attendance_trend(weeks int)` returns time-series of (eventDate, count) for last N weeks of counted events.
  - `dashboard_at_risk()` returns rows {servantId, servantName, persons:[{personId, personName, streak, lastEventTitle, lastEventDate}]}, limited.
  - `dashboard_newcomer_funnel(days int)` returns counts {quickAdd, upgraded, active}.
  - `dashboard_region_breakdown(top int)` returns rows {region, count}, "Other" rolled up beyond top N.

## 2. Admin invite

- [ ] 2.1 Edge Function `supabase/functions/invite-servant/index.ts`: uses service-role to call `supabase.auth.admin.inviteUserByEmail` and `INSERT INTO servants`. Admin-auth-required (verified via JWT check inside the function).
- [ ] 2.2 `024_admin_servant_rpcs.sql`: `update_servant_role(servant_id, role)`, `deactivate_servant(servant_id)`, `reactivate_servant(servant_id)` — admin-only.
- [ ] 2.3 `024_admin_servant_rpcs.sql`: revise `get_my_servant()` to return null when `deactivated_at IS NOT NULL`.

## 3. Mobile API + types

- [ ] 3.1 `src/services/api/dashboard.ts` exposing typed wrappers.
- [ ] 3.2 `src/services/api/adminServants.ts` exposing invite/role/deactivate.
- [ ] 3.3 Types in `src/types/dashboard.ts`.

## 4. Admin layout

- [ ] 4.1 `app/(app)/admin/_layout.tsx`: bottom-tab nav for admins with Dashboard, Persons, Counted Events, Alerts, Servants.
- [ ] 4.2 `app/(app)/_layout.tsx`: when `role==='admin'` and route is `/`, redirect to `/admin/dashboard`.

## 5. Dashboard screen

- [ ] 5.1 `app/(app)/admin/dashboard.tsx` — sectioned scroll view:
  - Overview cards row (Paper Card components).
  - Attendance trend (LineChart from `react-native-chart-kit`).
  - At-risk list (grouped by servant, collapsible).
  - Newcomer funnel (custom horizontal bars or BarChart).
  - Region breakdown (BarChart).
- [ ] 5.2 Pull-to-refresh invalidates all dashboard queries.

## 6. Servants management

- [ ] 6.1 `app/(app)/admin/servants.tsx`:
  - List of servants showing display name, email, role, active state.
  - "Invite servant" button → modal with email + display name + role picker.
  - Per-row actions: Promote/Demote, Deactivate/Reactivate.

## 7. Number formatting

- [ ] 7.1 `src/utils/formatNumber.ts`: locale-aware number, percentage, and date formatters via Intl.

## 8. Translations

- [ ] 8.1 `admin.dashboard.*`: section titles, card labels, units (events, members, %), chart titles, loading/error states, refresh.
- [ ] 8.2 `admin.servants.*`: list title, columns, invite, promote, demote, deactivate, reactivate, dialogs, success/error.

## 9. Tests

- [ ] 9.1 Integration: each dashboard RPC returns expected shape against seeded data.
- [ ] 9.2 Integration: `invite-servant` succeeds for admin, fails for non-admin.
- [ ] 9.3 Integration: `deactivate_servant` blocks subsequent `get_my_servant` for the deactivated user.
- [ ] 9.4 Component: dashboard renders cards + charts; empty states visible when zero data.
- [ ] 9.5 Component: servants screen renders list and invite modal.

## 10. Verification (in Expo Go)

- [ ] 10.1 Sign in as admin → lands on /admin/dashboard.
- [ ] 10.2 All 5 sections render with seeded data.
- [ ] 10.3 Pull to refresh updates numbers.
- [ ] 10.4 Switch to AR → numbers render with Arabic-Indic digits.
- [ ] 10.5 Open Servants screen → invite a new servant → magic-link email arrives → new user can sign in once magic link is consumed.
- [ ] 10.6 Deactivate that servant → magic link still valid but `get_my_servant` returns null → user is signed out with error.
- [ ] 10.7 Sign in as non-admin → no admin tabs visible; navigating directly to /admin/dashboard redirects to home.
- [ ] 10.8 `openspec validate add-admin-dashboard` passes.
