# Roadmap

> Last updated: 2026-04-01

## Phase Overview

| Phase | Name                        | Duration  | Status  | Depends On |
| ----- | --------------------------- | --------- | ------- | ---------- |
| 1     | Foundation                  | —         | ✅ Done | —          |
| 2     | Person Management           | 2 weeks   | Planned | Phase 1    |
| 3     | Attendance & Offline Sync   | 2 weeks   | Planned | Phase 2    |
| 4     | Absence Alerts & Follow-ups | 2 weeks   | Planned | Phase 3    |
| 5     | Reports & Dashboards        | 1.5 weeks | Planned | Phase 4    |
| 6     | Polish, Deployment & Launch | 1.5 weeks | Planned | Phase 5    |

**Total estimated: ~9 weeks** (part-time, solo developer)

---

## Cross-Verification Notes (2026-04-01)

Discrepancies found between docs and codebase, resolved as follows:

| Doc Claim | Reality | Resolution |
|---|---|---|
| Tech stack: NativeWind v4 | Installed but unconfigured (no tailwind.config.js, no babel plugin). All components use inline StyleSheet. | **Do not adopt.** Continue inline StyleSheet. Remove `nativewind` + `tailwindcss` in Phase 6. |
| Tech stack: Phosphor Icons | Not installed. Code uses `@expo/vector-icons` (Ionicons). | Use `@expo/vector-icons`. Docs updated. |
| `scripts.lint` works | `echo 'TODO'` — ESLint not configured | Set up ESLint as first commit of Phase 2. |
| Jest configured | No `jest.config.js`, no test devDeps | Set up Jest as first commit of Phase 2. |
| Path aliases work | `tsconfig.json` declares `@/*` but `babel.config.js` lacks `babel-plugin-module-resolver` | Wire aliases in Babel as first commit of Phase 2. |
| API in `src/api/queries/` | Only `src/api/supabase.ts` exists | Create `queries/` structure starting Phase 2. |

### Open Question Decisions

| OQ | Decision |
|---|---|
| OQ-1: SMS provider | Start with email magic link for dev. Phone OTP when Twilio configured. |
| OQ-2: Servant onboarding | Admin creates servant profile. Servant logs in. If not in `servants` table, show "Not authorized." |
| OQ-3: Phone format | Store E.164 always. Validate with Zod regex `^\+[1-9]\d{7,14}$`. |
| OQ-5: Counted events | Substring/prefix matching. Admin previews matches before saving. |
| OQ-6: Mark absent | Inferred: not marked present = absent after event window closes. |
| OQ-7: Absence check timing | pg_cron after each counted event's end time. |
| OQ-8: Duplicate alerts | One alert only. Skip persons with existing `pending` follow-up. |
| OQ-14: WhatsApp | Add "Contact via WhatsApp" button in Phase 4 follow-up detail. |

---

## Phase 1 — Foundation ✅

**Goal**: Project scaffolding, authentication, design system, database schema.

**Delivered** (2026-03-30):

- Expo project with TypeScript + Expo Router
- Theme system (Coptic Blue + Heritage Gold, Cairo typography, spacing, shadows, radius)
- i18next with EN/AR/DE + RTL support (131 keys)
- Supabase Auth with phone OTP
- Auth guard + onboarding flow (3 slides)
- Core UI: Button (4 variants), Card, Input, SyncStatusBadge, AttendanceChip
- Tab navigation: Home, Check In, People, More (with nested stack navigators)
- Supabase migrations: all tables, enums, indexes, RLS policies (00001 + 00002)
- Zustand stores: authStore, syncStore, settingsStore
- TypeScript types: Servant, Person, Attendance, FollowUp, AlertConfig, CachedEvent
- Supabase client with AsyncStorage persistence
- Dev tooling: .env.example, Makefile, Prettier (.prettierrc), .gitignore
- Documentation: architecture, data-model, local-dev, project-structure

**Screens**: Onboarding (complete), Login (complete), Home/CheckIn/People (placeholder shells), More menu (complete)

**Tests**: TypeScript compiles, app builds and runs.

**Known gaps** (addressed in Phase 2): ESLint not configured, Jest not configured, Babel path aliases not wired.

---

## Phase 2 — Person Management

**Goal**: Full CRUD for church members. Quick Add and Full Registration. Member list with search.

### Dev Setup (first commits)

These fix Phase 1 gaps before any feature work:

1. Install `babel-plugin-module-resolver` → wire `@/*` path aliases in `babel.config.js`
2. Install + configure ESLint: `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `eslint-plugin-react`, `eslint-plugin-react-hooks`. Create `.eslintrc.js`. Fix `scripts.lint`.
3. Install + configure Jest: `jest-expo`, `@testing-library/react-native`. Create `jest.config.js`.

### Database Changes

New migration `supabase/migrations/00003_rpc_functions.sql`:
- `get_my_group(servant_id)` — see `api-design.md` lines 186-228
- `get_dashboard_stats()` — see `api-design.md` lines 232-259
- `get_attendance_for_event(event_id, event_date)` — see `api-design.md` lines 264-288
- `bulk_upsert_attendance(records)` — see `api-design.md` lines 292-329

### Deliverables

| #    | Item                                        | Type   |
| ---- | ------------------------------------------- | ------ |
| 2.0  | ESLint + Jest + Babel path alias setup      | Infra  |
| 2.1  | Zod schemas for person validation           | Code   |
| 2.2  | Person API queries + TanStack Query hooks   | Code   |
| 2.3  | Quick Add screen                            | Screen |
| 2.4  | Full Registration screen                    | Screen |
| 2.5  | Member list with search + filters           | Screen |
| 2.6  | Member profile screen                       | Screen |
| 2.7  | Edit person flow (upgrade Quick Add → Full) | Screen |
| 2.8  | RPC functions migration (00003)             | Backend |
| 2.9  | Phone validation (E.164, duplicate check)   | Code   |
| 2.10 | Unit tests for validation schemas           | Tests  |
| 2.11 | Integration tests for person RLS policies   | Tests  |

### Files to Create

| File | Purpose |
|---|---|
| `.eslintrc.js` | ESLint configuration |
| `jest.config.js` | Jest configuration |
| `src/api/queries/persons.ts` | Supabase CRUD functions |
| `src/api/queries/servants.ts` | Servant list fetch |
| `src/hooks/usePersons.ts` | TanStack Query hooks |
| `src/hooks/useServants.ts` | TanStack Query hook |
| `src/utils/validation.ts` | Zod schemas (quickAddSchema, fullRegistrationSchema) |
| `src/utils/phone.ts` | E.164 normalize + format display |
| `src/components/PhoneInput.tsx` | Phone input with country code picker (default +49) |
| `src/components/SelectPicker.tsx` | Dropdown select |
| `src/components/SearchBar.tsx` | Debounced search with clear |
| `src/components/FilterChips.tsx` | Horizontal filter row |
| `app/(tabs)/people/quick-add.tsx` | Quick Add form |
| `app/(tabs)/people/register.tsx` | Full Registration form |
| `app/(tabs)/people/[personId].tsx` | Person detail/edit |
| `supabase/migrations/00003_rpc_functions.sql` | All RPC functions |

### Files to Modify

| File | Change |
|---|---|
| `package.json` | Add devDeps (jest-expo, testing-library, eslint, babel-plugin-module-resolver) |
| `babel.config.js` | Add module-resolver for `@/*` |
| `app/(tabs)/people/index.tsx` | Replace placeholder with member list + search + FAB |
| `app/(tabs)/people/_layout.tsx` | Add stack screens |
| `app/(tabs)/home.tsx` | Wire "Recent Newcomers" card |
| `supabase/seed.sql` | Populate with realistic data |
| `src/i18n/{en,ar,de}.json` | Add validation, registration keys |

### Tests

- `__tests__/utils/validation.test.ts` — Zod schemas valid/invalid
- `__tests__/utils/phone.test.ts` — E.164 normalization
- `supabase/tests/rls_test.ts` — Person RLS policies
- `supabase/tests/rpc_test.ts` — RPC functions return expected results

### Manual Verification

1. Open Quick Add → fill form → submit → see member in list
2. Open Full Registration → fill all fields → submit → see member profile
3. Search for member by name → tap → view profile
4. Filter by status (New/Active/Inactive) → correct results
5. Edit a Quick Add → add priority + comments → registration_type changes to `full`
6. Switch language to Arabic → layout flips RTL → all labels translated
7. Submit duplicate phone → see "This phone number is already registered."
8. Admin deletes a member → confirmation → member gone

### Suggested Commits

```
chore: configure eslint, jest, and babel path aliases
feat: add RPC functions migration (get_my_group, get_dashboard_stats, bulk_upsert_attendance)
feat: add Zod schemas for person validation and phone utilities
feat: add Supabase query functions for persons and servants
feat: add TanStack Query hooks for persons and servants
feat: add PhoneInput, SelectPicker, SearchBar, FilterChips components
feat: implement member list with search and filters
feat: implement Quick Add screen
feat: implement Full Registration screen
feat: implement member profile screen
feat: wire Recent Newcomers card on home screen
test: add person validation and phone utility tests
test: add RLS and RPC integration tests
chore: populate seed data with servants and persons
docs: update data-model.md, screens.md, CHANGELOG for Phase 2
```

### Dependencies

- Phase 1 complete ✅
- Supabase local running with seed data

---

## Phase 3 — Attendance & Offline Sync

**Goal**: Google Calendar event fetching, attendance check-in flow, local SQLite for offline-first.

### New Dependencies

`expo-sqlite`, `drizzle-orm`, `drizzle-kit`, `@react-native-community/netinfo`

### Deliverables

| #    | Item                                                | Type    |
| ---- | --------------------------------------------------- | ------- |
| 3.1  | Edge Function: `fetch-events` (Google Calendar API) | Backend |
| 3.2  | pg_cron job to trigger fetch-events every 30 min    | Backend |
| 3.3  | Local SQLite schema (drizzle-orm)                   | Code    |
| 3.4  | Sync engine (sync_queue + background job)           | Code    |
| 3.5  | SyncStatusBadge connected to real sync state        | Code    |
| 3.6  | Event list screen (full implementation)             | Screen  |
| 3.7  | Attendance marking screen                           | Screen  |
| 3.8  | Offline-optimistic UI for attendance                | Code    |
| 3.9  | Unit tests for sync engine                          | Tests   |
| 3.10 | Integration tests for attendance RPC                | Tests   |
| 3.11 | Edge Function tests for fetch-events                | Tests   |

### Files to Create

| File | Purpose |
|---|---|
| `supabase/functions/fetch-events/index.ts` | Edge Function: Google Calendar → cached_events |
| `supabase/functions/_shared/google-auth.ts` | Google service account JWT generation |
| `supabase/functions/_shared/supabase-admin.ts` | Service-role Supabase client |
| `src/api/queries/events.ts` | Event fetch functions |
| `src/api/queries/attendance.ts` | Attendance CRUD functions |
| `src/hooks/useEvents.ts` | TanStack Query hooks |
| `src/hooks/useAttendance.ts` | TanStack Query hooks |
| `src/hooks/useSync.ts` | Sync engine control (30s interval + connectivity change) |
| `src/db/schema.ts` | Drizzle schema for local SQLite |
| `src/db/client.ts` | expo-sqlite initialization |
| `src/db/sync.ts` | Sync engine: processQueue, pullRemoteChanges, resolveConflicts |
| `src/db/migrations/0001_initial.sql` | Local schema creation |
| `src/components/EventCard.tsx` | Event list item |
| `src/components/AttendanceRow.tsx` | Person row with present/absent toggle |

### Files to Modify

| File | Change |
|---|---|
| `app/(tabs)/checkin/index.tsx` | Show today's events + past 3 days |
| `app/(tabs)/checkin/[eventId].tsx` | Full check-in with roster, toggles, search, save |
| `app/_layout.tsx` | Initialize SQLite, start sync background job |
| `src/stores/syncStore.ts` | Wire to actual sync queue count |
| `Makefile` | Add `deploy-function-events` target |
| `package.json` | Add new deps |

### Sync Engine Design

```
Write -> SQLite (immediate) -> sync_queue -> UI updated
Background (30s) or online event -> process queue FIFO:
  - Push: bulk_upsert_attendance RPC (WHERE marked_at < EXCLUDED.marked_at)
  - Success: remove from queue, set synced_at
  - Network error: increment attempts, retry (max 5 then mark failed)
Pull: GET records updated since last_synced -> upsert local SQLite -> update sync_meta
```

### Tests

- `__tests__/db/sync.test.ts` — Queue FIFO, conflict resolution, retry logic
- `supabase/tests/rpc_test.ts` — `bulk_upsert_attendance` behavior
- `supabase/functions/fetch-events/__tests__/` — Google Calendar parsing

### Manual Verification

1. Open Check In → see today's events from Google Calendar
2. Tap an event → see member list → toggle present/absent → Save
3. Turn on airplane mode → mark attendance → see "Pending: 3" badge
4. Turn off airplane mode → sync happens → badge shows "Synced"
5. Two servants mark the same visitor → last write wins → no crash
6. Past events (last 3 days) visible in expandable section

### Suggested Commits

```
chore: install expo-sqlite, drizzle-orm, drizzle-kit, netinfo
feat: add local SQLite schema with drizzle-orm
feat: implement SQLite client initialization and migrations
feat: implement sync engine with queue and background job
feat: add Google auth JWT utility for Edge Functions
feat: add service-role Supabase client for Edge Functions
feat: implement fetch-events Edge Function
feat: add events and attendance query functions and hooks
feat: implement event list screen
feat: implement attendance marking screen with roster and save
feat: connect SyncStatusBadge to real sync state
test: add sync engine unit tests
test: add attendance RPC and fetch-events Edge Function tests
docs: update architecture.md, api-design.md, CHANGELOG for Phase 3
```

### Dependencies

- Phase 2 complete (persons exist to mark attendance for)
- Google Calendar service account configured
- `GOOGLE_SERVICE_ACCOUNT_KEY` and `GOOGLE_CALENDAR_ID` in .env

---

## Phase 4 — Absence Alerts & Follow-ups

**Goal**: Absence detection, follow-up workflow, push notifications.

### New Dependencies

`expo-notifications`, `expo-device`

### Database Changes

New migration `supabase/migrations/00004_absence_functions.sql`:
- `get_absence_streaks()` — persons with consecutive misses >= threshold (see `api-design.md` lines 336-382)
- `get_weekly_attendance_trend(weeks)` — weekly attendance counts (see `api-design.md` lines 386-406)
- Index: `idx_attendance_person_date ON attendance(person_id, event_date DESC)`

### Deliverables

| #    | Item                                           | Type    |
| ---- | ---------------------------------------------- | ------- |
| 4.1  | `get_absence_streaks` RPC + indexes            | Backend |
| 4.2  | Edge Function: `check-absences`                | Backend |
| 4.3  | Edge Function: `send-notification`             | Backend |
| 4.4  | Push token registration on app launch          | Code    |
| 4.5  | Notification channels (Android)                | Code    |
| 4.6  | Deep linking from notifications                | Code    |
| 4.7  | Follow-up list screen                          | Screen  |
| 4.8  | Follow-up detail screen                        | Screen  |
| 4.9  | Settings screen (language + alert config)      | Screen  |
| 4.10 | "On break" / pause alerts for a person         | Code    |
| 4.11 | Return detection ("Welcome back" notification) | Backend |
| 4.12 | WhatsApp contact button on follow-up detail    | Code    |
| 4.13 | Unit tests for streak calculation              | Tests   |
| 4.14 | Integration tests for follow-up RLS            | Tests   |
| 4.15 | Edge Function tests for check-absences         | Tests   |

### Files to Create

| File | Purpose |
|---|---|
| `supabase/migrations/00004_absence_functions.sql` | RPC + indexes |
| `supabase/functions/check-absences/index.ts` | Absence detection + return detection |
| `supabase/functions/send-notification/index.ts` | Expo Push API wrapper (see `notifications.md`) |
| `src/api/queries/followUps.ts` | Follow-up CRUD |
| `src/api/queries/alertConfig.ts` | Alert config CRUD |
| `src/hooks/useFollowUps.ts` | TanStack Query hooks |
| `src/hooks/useAlertConfig.ts` | TanStack Query hooks |
| `src/hooks/useNotifications.ts` | Push token registration + deep linking |
| `src/components/FollowUpCard.tsx` | Follow-up list item |
| `app/(tabs)/more/follow-ups.tsx` | Follow-ups list (Pending / Snoozed / Completed tabs) |
| `app/(tabs)/more/follow-ups/[id].tsx` | Follow-up detail + action form |
| `app/(tabs)/more/settings.tsx` | Settings (language, notifications, alert config for admin) |

### Files to Modify

| File | Change |
|---|---|
| `app/(tabs)/people/[personId].tsx` | Add "On break" toggle, attendance history, follow-up history |
| `app/(tabs)/more/index.tsx` | Wire routes to follow-ups, settings |
| `app/(tabs)/more/_layout.tsx` | Add stack screens |
| `app/(tabs)/home.tsx` | Wire "Pending Follow-ups" card |
| `app/_layout.tsx` | Initialize push notification listener + deep linking |
| `app.config.ts` | Add expo-notifications plugin config |

### Tests

- `__tests__/utils/streaks.test.ts` — Streak calculation edge cases
- `supabase/tests/rpc_test.ts` — `get_absence_streaks()` results
- `supabase/functions/check-absences/__tests__/` — Follow-up creation, return detection
- `supabase/functions/send-notification/__tests__/` — Missing token handling, Expo API call

### Manual Verification

1. Seed member who missed 3+ events → run check-absences → notification arrives
2. Tap notification → opens follow-up detail for that person
3. Log follow-up action (Called) + notes → mark complete → disappears from pending
4. Snooze a follow-up until next week → disappears → reappears on that date
5. Mark person "On Break" → no alerts generated → resume date passes → alerts resume
6. Previously-flagged person attends → "Welcome Back" notification sent
7. Admin configures counted events + threshold → changes take effect
8. Tap "Contact via WhatsApp" → opens WhatsApp with phone number

### Suggested Commits

```
chore: install expo-notifications and expo-device
feat: add absence streak RPC and indexes migration
feat: implement check-absences Edge Function
feat: implement send-notification Edge Function
feat: add follow-ups and alert config query functions and hooks
feat: implement push notification registration and deep linking
feat: implement follow-ups list screen with status tabs
feat: implement follow-up detail screen with action form and WhatsApp
feat: implement settings screen with language and alert config
feat: add "on break" and history to person profile
feat: wire pending follow-ups card on home screen
test: add streak calculation and absence detection tests
test: add Edge Function tests
docs: update notifications.md, api-design.md, CHANGELOG for Phase 4
```

### Dependencies

- Phase 3 complete (attendance data exists for streak calculation)
- Expo push token configured in app.config.ts
- `EXPO_PUSH_ACCESS_TOKEN` in .env

---

## Phase 5 — Reports & Dashboards

**Goal**: Admin reports, servant dashboard, data visualizations.

### New Dependencies

`victory-native` (charting, works with react-native-reanimated already installed)

### Deliverables

| #    | Item                                     | Type    |
| ---- | ---------------------------------------- | ------- |
| 5.1  | Home screen — servant dashboard (full)   | Screen  |
| 5.2  | Home screen — admin dashboard (full)     | Screen  |
| 5.3  | Reports screen — attendance trend chart  | Screen  |
| 5.4  | Reports screen — at-risk list            | Screen  |
| 5.5  | Reports screen — newcomer funnel         | Screen  |
| 5.6  | Reports screen — region breakdown        | Screen  |
| 5.7  | Chart components (victory-native)        | Code    |
| 5.8  | Tests for dashboard RPCs                 | Tests   |

Note: `get_dashboard_stats` and `get_weekly_attendance_trend` RPCs are created in Phase 2 (migration 00003) and Phase 4 (migration 00004) respectively.

### Files to Create

| File | Purpose |
|---|---|
| `src/api/queries/dashboard.ts` | Dashboard stat + trend + region queries |
| `src/hooks/useReports.ts` | TanStack Query hooks for report data |
| `src/components/StatCard.tsx` | Metric card: icon, label, value, trend |
| `src/components/AttendanceTrendChart.tsx` | Line chart (victory-native) |
| `src/components/AtRiskList.tsx` | At-risk persons with streak counts |
| `src/components/NewcomerFunnel.tsx` | Bar chart: Quick Adds → Full → Active |
| `src/components/RegionBreakdown.tsx` | Table: region, count, rate |
| `app/(tabs)/more/reports.tsx` | Admin reports dashboard |

### Files to Modify

| File | Change |
|---|---|
| `app/(tabs)/home.tsx` | Full implementation: servant + admin views with real data |
| `app/(tabs)/more/index.tsx` | Wire Reports route (admin only) |
| `app/(tabs)/more/_layout.tsx` | Add reports stack screen |

### Tests

- `supabase/tests/rpc_test.ts` — `get_dashboard_stats()` and `get_weekly_attendance_trend()` results

### Manual Verification

1. Servant home shows my group count, pending follow-ups, recent newcomers
2. Admin home shows total members, attendance rate, at-risk count
3. Reports chart shows 12-week attendance trend
4. At-risk list links to member profiles
5. Newcomer funnel shows progression Quick Add → Full → Active
6. Region breakdown shows correct distribution
7. Charts render correctly in Arabic (RTL)

### Suggested Commits

```
chore: install victory-native
feat: add dashboard query functions and hooks
feat: add StatCard, chart, and report components
feat: implement servant dashboard on home screen
feat: implement admin dashboard on home screen
feat: implement admin reports screen
test: add dashboard RPC tests
docs: update screens.md, CHANGELOG for Phase 5
```

### Dependencies

- Phase 4 complete (follow-ups and attendance data populated)

---

## Phase 6 — Polish, Deployment & Launch

**Goal**: Edge cases, performance, CI/CD pipeline, TestFlight/APK distribution.

### Deployment Architecture

| Component | Target | Method |
|---|---|---|
| Supabase (Postgres, Auth) | Supabase Cloud (EU Frankfurt) | Managed |
| Edge Functions | Supabase Cloud (v1) | `supabase functions deploy` via GitHub Actions |
| Migrations | Supabase Cloud | `supabase db push` via GitHub Actions |
| Mobile App | TestFlight + APK | EAS Build via GitHub Actions |
| Self-hosted fallback | RPi 5 K8s | deployment.yaml + Dockerfile ready (see `deployment.md`) |

### Deliverables

| #    | Item                                            | Type   |
| ---- | ----------------------------------------------- | ------ |
| 6.1  | GitHub Actions: CI (lint, typecheck, test)      | Infra  |
| 6.2  | GitHub Actions: deploy Edge Functions           | Infra  |
| 6.3  | EAS Build configuration (eas.json)              | Infra  |
| 6.4  | Seed script finalized + seed-auth-users script  | Code   |
| 6.5  | Error boundary + crash recovery                 | Code   |
| 6.6  | Loading states and skeleton screens             | Code   |
| 6.7  | Empty states for all screens                    | Code   |
| 6.8  | Accessibility labels on all interactive elements | Code   |
| 6.9  | i18n completeness test                          | Tests  |
| 6.10 | Remove unused deps (nativewind, tailwindcss)    | Chore  |
| 6.11 | TestFlight distribution + internal APK          | Infra  |
| 6.12 | All documentation finalized                     | Docs   |

### Files to Create

| File | Purpose |
|---|---|
| `.github/workflows/ci.yml` | CI: typecheck, eslint, prettier, jest |
| `.github/workflows/deploy.yml` | Deploy Edge Functions on merge to main |
| `eas.json` | Build profiles: preview (internal), production (store) |
| `scripts/seed-auth-users.ts` | Create auth.users via Supabase admin API |
| `src/components/EmptyState.tsx` | Reusable: icon, message, CTA |
| `src/components/SkeletonLoader.tsx` | Loading placeholder |

### Polish Checklist

- [ ] Every list screen: loading, empty, error states
- [ ] All interactive elements: `accessibilityLabel` + `accessibilityRole`
- [ ] All touch targets >= 48px
- [ ] RTL tested on all screens with Arabic
- [ ] Pull-to-refresh on all list screens
- [ ] Keyboard avoiding view on all form screens
- [ ] Error boundary at root layout
- [ ] Remove all `console.log` statements
- [ ] Remove `nativewind` and `tailwindcss` from package.json

### Seed Data (finalized)

- 5 servants (2 admin, 3 servants) across different languages/regions
- 20 persons with varied statuses, priorities, regions, languages
- 60+ attendance records across 4 events over 8 weeks
- 5-8 follow-ups (pending, completed, snoozed)
- 3 cached events (Sunday Liturgy, Youth Meeting, Bible Study)
- 1 alert config (patterns, threshold 3, priority overrides)

### Tests

- `__tests__/i18n/completeness.test.ts` — all keys exist in all 3 languages
- Coverage check: 80%+ on `src/utils/`, `src/db/`, `supabase/functions/`
- Manual E2E: install → onboard → login → register → check in → get alert → follow up → reports

### Manual Verification

1. Install fresh on iOS (TestFlight) and Android (APK)
2. Complete full user journey as servant
3. Complete full user journey as admin
4. Test offline mode: airplane mode for 10 minutes, queue actions, come back online
5. Test all 3 languages
6. Test push notifications on both platforms

### Suggested Commits

```
chore: add GitHub Actions CI workflow
chore: add GitHub Actions deploy workflow and eas.json
feat: add EmptyState and SkeletonLoader components
feat: add error boundary to root layout
refactor: add loading, error, and empty states to all screens
feat: add accessibility labels to all interactive elements
chore: create comprehensive seed data with seed-auth-users script
test: add i18n completeness test and coverage thresholds
chore: remove unused dependencies (nativewind, tailwindcss)
docs: finalize all documentation, update CHANGELOG for Phase 6
```

### Dependencies

- All previous phases complete
- Apple Developer account (for TestFlight)
- EAS account configured

---

## Phase Gate Checklist

Every phase must pass before the next begins:

- [ ] All new tests pass (`make test`)
- [ ] TypeScript compiles (`make typecheck`)
- [ ] Lint passes (`make lint`)
- [ ] App builds on iOS and Android
- [ ] New functionality demonstrated (manual verification above)
- [ ] Documentation updated (relevant .md files)
- [ ] All commits use conventional format (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`)
- [ ] No broken screens or navigation
