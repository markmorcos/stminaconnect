# Tasks — add-admin-dashboard

## 1. Aggregation RPCs

- [x] 1.1 `027_dashboard_rpcs.sql`:
  - `dashboard_overview()` returns single row with totalMembers, activeLast30, newThisMonth, avgAttendance4w.
  - `dashboard_attendance_trend(weeks int)` returns time-series of (eventDate, count) for last N weeks of counted events.
  - `dashboard_at_risk()` returns rows {servantId, servantName, persons:[{personId, personName, streak, lastEventTitle, lastEventDate}]}, limited.
  - `dashboard_newcomer_funnel(days int)` returns counts {quickAdd, upgraded, active}.
  - `dashboard_region_breakdown(top int)` returns rows {region, count}, "Other" rolled up beyond top N.

## 2. Admin invite & lifecycle

- [x] 2.1 Edge Function `supabase/functions/invite-servant/index.ts`: uses service-role to call `supabase.auth.admin.inviteUserByEmail` and `INSERT INTO servants`. Admin-auth-required (verified via JWT check inside the function).
- [x] 2.2 `028_admin_servant_rpcs.sql`: `list_servants()`, `update_servant_role(servant_id, role)`, `deactivate_servant(servant_id)`, `reactivate_servant(servant_id)` — admin-only.
- [x] 2.3 `028_admin_servant_rpcs.sql`: revise `get_my_servant()` to return null when `deactivated_at IS NOT NULL`.

## 3. Mobile API + types

- [x] 3.1 `src/services/api/dashboard.ts` exposing typed wrappers per RPC.
- [x] 3.2 `src/services/api/adminServants.ts` exposing invite/role/deactivate.
- [x] 3.3 Types in `src/types/dashboard.ts`.

## 4. App shell — bottom tab navigation

- [x] 4.1 Create `app/(app)/(tabs)/_layout.tsx` using Expo Router `Tabs`. Four tabs: Home, Persons, Follow-ups, Settings. Active style from design-system tokens. Translated labels via `tabs.*` keys.
- [x] 4.2 Move `app/(app)/follow-ups.tsx` → `app/(app)/(tabs)/follow-ups.tsx`. URL `/follow-ups` unchanged.
- [x] 4.3 Add `app/(app)/(tabs)/persons.tsx` re-exporting the existing persons list as the Persons tab entry (keep `app/(app)/persons/[id].tsx` outside `(tabs)` so the tab bar hides on profile).
- [x] 4.4 Verify sub-routes hide the tab bar: `/registration/*`, `/attendance`, `/notifications`, `/settings/account`, `/settings/language`, `/admin/*`, `/about`, `/dev/*`, `/persons/[id]` all render without the tab bar. (Manual verification — Section 12.)
- [x] 4.5 Translation keys: `tabs.home`, `tabs.persons`, `tabs.followUps`, `tabs.settings` (EN/AR/DE).

## 5. App shell — role-aware Home tab

- [x] 5.1 Extract the existing launcher tile content from `app/(app)/index.tsx` into `src/features/home/ServantHome.tsx` (placeholder — Phase 17 replaces it with the servant dashboard).
- [x] 5.2 Build `src/features/admin-dashboard/AdminDashboard.tsx` — sectioned scroll view:
  - Overview cards row (Paper Card components).
  - Attendance trend (LineChart from `react-native-chart-kit`).
  - At-risk list (grouped by servant, collapsible).
  - Newcomer funnel (custom horizontal bars or BarChart).
  - Region breakdown (BarChart).
- [x] 5.3 `app/(app)/(tabs)/index.tsx` (the moved Home tab file): branch on `servant.role` and render `<AdminDashboard />` or `<ServantHome />`. No `Redirect` — URL stays `/` for both roles.
- [x] 5.4 Pull-to-refresh on the admin dashboard invalidates all five dashboard queries.

## 6. App shell — header (bell + dev-only kebab)

- [x] 6.1 Build a shared `src/components/TabHeader.tsx` accepting `title` plus optional right-side adornments. Renders: title, bell with `notificationsStore.unreadCount` badge → `/notifications`, dev-only overflow menu.
- [x] 6.2 Overflow menu: rendered only when `__DEV__ === true || EXPO_PUBLIC_SHOW_DEV_TOOLS === 'true'`. Contents: DB Inspector → `/dev/db`, Showcase → `/dev/showcase`. Production build must render no kebab icon at all.
- [x] 6.3 Wire `TabHeader` into all four tab screens with translated titles (`tabs.*`).
- [x] 6.4 Remove the previous home overflow menu in `app/(app)/index.tsx` (after the Home content move in 5.x).

## 7. App shell — consolidated Settings tab

- [x] 7.1 Create `app/(app)/(tabs)/settings.tsx` — sectioned landing.
- [x] 7.2 App section rows: Account → `/settings/account`, Language → `/settings/language`, About → `/about`. Use design-system row primitive (or a simple `Pressable` over a `Card`/`Stack`).
- [x] 7.3 Admin section (rendered only when `servant.role === 'admin'`): Counted Events → `/admin/counted-events`, Alert thresholds → `/admin/alerts`, Servants → `/admin/servants`. Section header hidden entirely for non-admins.
- [x] 7.4 Divider, then Sign Out as the last row, styled destructively. On press call `useSignOutWithGuard().request()` so the existing pending-writes confirmation still fires.
- [x] 7.5 Translation keys: `settings.section.app`, `settings.section.admin`, `settings.signOut` (or reuse `home.signOut`).
- [x] 7.6 Remove the old `app/(app)/settings/_layout.tsx`'s Stack-only wrapper if the sub-pages can render their own headers; otherwise keep it as the sub-stack for `/settings/*` only (no longer the tab landing). (Kept as sub-stack for `/settings/*`.)

## 8. Servants management

- [x] 8.1 `app/(app)/admin/servants.tsx` (sub-route, NOT a tab):
  - List of servants showing display name, email, role, active state.
  - "Invite servant" button → modal with email + display name + role picker.
  - Per-row actions: Promote/Demote, Deactivate/Reactivate.
- [x] 8.2 Add `Stack.Screen` entry in `app/(app)/admin/_layout.tsx` for `servants` with translated title.

## 9. Number formatting

- [x] 9.1 `src/utils/formatNumber.ts`: locale-aware number, percentage, and date formatters via Intl.

## 10. Translations

- [x] 10.1 `admin.dashboard.*`: section titles, card labels, units (events, members, %), chart titles, loading/error states, refresh.
- [x] 10.2 `admin.servants.*`: list title, columns, invite, promote, demote, deactivate, reactivate, dialogs, success/error.
- [x] 10.3 `tabs.*`, `settings.section.*` (added in 4.5 and 7.5) verified for EN/AR/DE.

## 11. Tests

- [x] 11.1 Integration: each dashboard RPC returns expected shape against seeded data. (`tests/dashboard/rpcIntegration.test.ts` — gated on `SUPABASE_TEST_*` env vars.)
- [x] 11.2 Integration: `invite-servant` succeeds for admin, fails for non-admin. (`tests/admin-servants/integration.test.ts`.)
- [x] 11.3 Integration: `deactivate_servant` blocks subsequent `get_my_servant` for the deactivated user. (Same file.)
- [x] 11.4 Component: dashboard renders cards + charts; empty states visible when zero data. (`tests/admin-dashboard/adminDashboard.test.tsx` — also covers per-section error placeholder.)
- [x] 11.5 Component: servants screen renders list and invite modal. (`tests/admin-servants/servantsScreen.test.tsx`.)
- [x] 11.6 Component: Home tab renders `<AdminDashboard />` for admin role and `<ServantHome />` for servant role. (`tests/shell/homeTab.test.tsx`.)
- [x] 11.7 Component: Settings tab renders the App section for servants and the App + Admin sections for admins; Sign Out triggers the guard dialog. (`tests/shell/settingsTab.test.tsx`.)
- [x] 11.8 Component: `TabHeader` renders the bell with badge; in production-flagged build the kebab is absent; in dev the kebab lists only DB Inspector + Showcase. (`tests/shell/tabHeader.test.tsx`. Required extracting `SHOW_DEV_TOOLS` into `src/components/devToolsFlag.ts` so tests can mock it without `jest.resetModules()`.)
- [x] 11.9 Component: tab bar is hidden on `/registration/quick-add`, `/settings/account`, `/admin/counted-events`, `/persons/[id]`, `/about`. — Deferred to manual verification (Section 12.11). Tab-bar visibility is structural (those routes live outside the `(tabs)` group), and Expo Router doesn't expose a unit-testable surface for it without a full navigator harness.

## 12. Verification (in Expo Go)

- [x] 12.1 Sign in as admin → Home tab shows admin dashboard at URL `/` (no redirect to `/admin/dashboard`).
- [x] 12.2 All 5 dashboard sections render with seeded data.
- [x] 12.3 Pull to refresh updates numbers.
- [x] 12.4 Switch to AR → numbers render with Arabic-Indic digits and tab labels appear in Arabic.
- [x] 12.5 Sign in as non-admin → Home tab shows launcher tiles; Settings tab has no Admin section.
- [x] 12.6 As admin, open Settings → tap Servants → invite a new servant → magic-link email arrives → new user can sign in. (Verified end-to-end via the function smoke test against Mailpit and through the iOS deep-link path. Android Expo Go strips the URL fragment from custom-scheme handoffs, so the access_token never reaches the app — known platform limitation; production-grade verification deferred to dev-build in phase 20 `switch-to-development-build`.)
- [x] 12.7 Deactivate that servant → magic link still valid but `get_my_servant` returns null → user is signed out with error.
- [x] 12.8 Tap the bell on every tab → `/notifications` opens; badge count is correct.
- [x] 12.9 In dev build, the overflow menu on each tab lists only DB Inspector + Showcase. (In a release-flagged build, no overflow icon renders.)
- [x] 12.10 Tap Sign Out from Settings with a pending offline write queued → confirmation dialog appears.
- [x] 12.11 Navigate into `/registration/quick-add`, `/persons/[id]`, `/admin/counted-events` → tab bar is hidden; back navigation returns to the originating tab.
- [x] 12.12 `openspec validate add-admin-dashboard` passes.
