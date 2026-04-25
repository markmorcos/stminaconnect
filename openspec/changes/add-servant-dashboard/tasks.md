# Tasks — add-servant-dashboard

## 1. RPCs

- [ ] 1.1 `025_servant_dashboard_rpcs.sql`:
  - `servant_my_group(servant_id uuid default auth.uid())` returns rows {personId, firstName, lastName, region, lastAttendanceAt, streak, status, pausedUntil}.
  - `servant_pending_followups_count()` returns int.
  - `servant_recent_newcomers(days int default 30)` returns rows {personId, firstName, lastName, registeredAt, registrationType, region}.

## 2. Mobile API

- [ ] 2.1 Extend `src/services/api/dashboard.ts` with `getMyGroup`, `getPendingFollowupsCount`, `getRecentNewcomers`.

## 3. Home screen redesign

- [ ] 3.1 Restructure `app/(app)/index.tsx`:
  - Quick actions row.
  - My Group section (FlatList, sorted by status priority).
  - Pending follow-ups card with count badge + first 3 rows + "View all" link.
  - Recent newcomers list.
- [ ] 3.2 Each row tappable → navigate to person profile or relevant screen.
- [ ] 3.3 Pull-to-refresh.

## 4. Status logic

- [ ] 4.1 `src/features/servantDashboard/streakStatus.ts`: pure function `(streak, threshold, status, paused_until) => 'green'|'yellow'|'red'|'break'`.
- [ ] 4.2 Unit-test all branches.

## 5. Translations

- [ ] 5.1 `home.servant.*`: title, sections.{quickActions, myGroup, pendingFollowups, recentNewcomers}, status.{green, yellow, red, break}, lastSeen.{never, daysAgo, today, yesterday}, viewAll, empty.{myGroup, followups, newcomers}.

## 6. Tests

- [ ] 6.1 Integration: `servant_my_group` filters to assigned only; `assigned_servant=auth.uid()`.
- [ ] 6.2 Integration: streak field matches `compute_streak` for sampled persons.
- [ ] 6.3 Integration: `servant_recent_newcomers` returns rows across all servants.
- [ ] 6.4 Component: home renders the four sections; status colours match logic.
- [ ] 6.5 Component: pull-to-refresh invalidates queries.

## 7. Verification (in Expo Go)

- [ ] 7.1 Sign in as non-admin → home shows quick actions + my group + follow-ups + newcomers.
- [ ] 7.2 My Group sorted Red, Yellow, Green, On Break.
- [ ] 7.3 Tap a Red row → person profile → log a follow-up → return → home updates count and status (after pull or refetch).
- [ ] 7.4 Mark a Red person attended in roster → status flips to Green within seconds.
- [ ] 7.5 Switch to AR/DE → all labels translated; relative dates ("3 days ago") localized.
- [ ] 7.6 With empty data, all empty states visible.
- [ ] 7.7 `openspec validate add-servant-dashboard` passes.
