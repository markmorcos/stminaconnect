# St. Mina Connect — Master Plan

> Living document. Last updated: 2026-04-01.
> This is the single source of truth for the entire project plan.

---

## Table of Contents

1. [Vision & Principles](#vision--principles)
2. [Users & Roles](#users--roles)
3. [Feature Summary](#feature-summary)
4. [Tech Stack](#tech-stack)
5. [Architecture](#architecture)
6. [Data Model](#data-model)
7. [API Surface](#api-surface)
8. [Screens & Navigation](#screens--navigation)
9. [Offline-First Strategy](#offline-first-strategy)
10. [Internationalization](#internationalization)
11. [Notifications](#notifications)
12. [Deployment](#deployment)
13. [Phased Roadmap](#phased-roadmap)
14. [Cross-References](#cross-references)

---

## Vision & Principles

**St. Mina Connect** is a mobile app for St. Mina Coptic Orthodox Church in Munich, Germany. It tracks newcomers, records attendance, and alerts servants when members miss too many services — enabling pastoral follow-up.

| Principle         | What it means                                                                      |
| ----------------- | ---------------------------------------------------------------------------------- |
| Offline-first     | All writes queue locally (SQLite) and sync when online. Church WiFi is unreliable. |
| Trilingual        | English, Arabic (RTL), German. UI language follows device locale with override.    |
| Simple UX         | Every primary action ≤ 2 taps from home. Servants are not tech-savvy.              |
| Privacy           | Comments visible only to assigned servant + admins. GDPR applies (Germany).        |
| Solo-dev friendly | Minimal moving parts, managed services, free tiers.                                |

---

## Users & Roles

| Role        | Who                      | Permissions                                                                                                 |
| ----------- | ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **Admin**   | Priest / Church Leader   | Full CRUD on all data. Manage servants, regions, alert rules, reports.                                      |
| **Servant** | Volunteer / Group Leader | Register newcomers, check in members, manage follow-ups for assigned group. Can search/check-in any member. |

No member-facing role in v1. Members do not use the app.

---

## Feature Summary

### F1: Newcomer Registration

- **Quick Add**: Servant hands phone to newcomer at the door. 5 fields (name, phone, region, language). Auto-assigns to the servant.
- **Full Registration**: Adds priority, servant assignment override, private comments. Can upgrade a Quick Add.

### F2: Attendance Tracking

- Events sourced from Google Calendar (not managed by app).
- Servant picks an event → sees assigned members → taps to toggle present.
- Search across all members for visitors.
- Offline: cached events + member roster, attendance queued locally.

### F3: Absence Alerts

- Admin configures which events count + absence threshold (default 3 consecutive misses).
- After attendance save, system recalculates streaks.
- Threshold crossed → push notification to servant + in-app follow-up task.
- Servant logs action (called/texted/visited) and status (completed/snoozed).
- "On break / Traveling" pauses alerts.
- Return detection: "Welcome back" notification when flagged person attends again.

### F4: Reports & Dashboards

- **Admin**: overview cards, attendance trend chart, at-risk list, newcomer funnel, region breakdown.
- **Servant**: my group with streak indicators, pending follow-ups, recent newcomers.

---

## Tech Stack

| Layer        | Choice                                | Rationale                                                                 |
| ------------ | ------------------------------------- | ------------------------------------------------------------------------- |
| Mobile       | React Native + Expo (managed)         | Cross-platform, OTA updates, solo-dev friendly                            |
| Navigation   | Expo Router                           | File-based routing, deep linking from push notifications                  |
| Backend      | Supabase (EU Frankfurt)               | Postgres + Auth + Edge Functions + RLS. Free tier. GDPR (EU hosting).     |
| Local DB     | expo-sqlite + drizzle-orm             | Offline-first with type-safe queries. Lighter than WatermelonDB.          |
| Server state | TanStack Query                        | Cache, background refetch, optimistic updates                             |
| Client state | Zustand                               | Lightweight global state (auth, sync status, settings)                    |
| Forms        | React Hook Form + Zod                 | Performant validation, schema reuse                                       |
| i18n         | i18next + react-i18next               | RTL Arabic, namespace-based keys, device locale detection                 |
| UI           | Custom components + inline StyleSheet | Theme tokens from design system. RTL-safe with Start/End directional styles. |
| Icons        | @expo/vector-icons (Ionicons)         | Already installed, covers all needed glyphs                               |
| Auth         | Supabase OTP (phone/email)            | No passwords. Magic link fallback for email.                              |
| Calendar     | Google Calendar API via Edge Function | Service account. Cached server-side.                                      |
| Push         | expo-notifications + Expo Push API    | Absence alerts, welcome-back, follow-up reminders                         |
| Font         | Cairo (Google Fonts)                  | Arabic-Latin bilingual coverage                                           |
| Deployment   | Supabase Cloud (v1) + Pi5 fallback    | Edge Functions on Supabase Cloud. Pi5 Dockerfile + deployment.yaml ready as fallback. |

---

## Architecture

See [/docs/architecture.md](./architecture.md) for full diagrams.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Expo App        │────▶│  Supabase        │────▶│ Google Calendar │
│                  │◀────│  (EU Frankfurt)  │◀────│ (Service Acct)  │
│  SQLite (local)  │     │  Postgres + Auth │     └─────────────────┘
│  Zustand         │     │  Edge Functions  │
│  TanStack Query  │     │  RLS Policies    │     ┌─────────────────┐
│  i18next         │     │  Realtime        │────▶│ Expo Push API   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Key Data Flows

1. **Events**: Google Calendar → Edge Function (cron 30min) → `cached_events` → Client SQLite
2. **Attendance**: Client SQLite → sync queue → Supabase `attendance`
3. **Absence Alerts**: Edge Function reads attendance → calculates streaks → creates follow_ups → sends push
4. **Auth**: Phone OTP → Supabase Auth → JWT in AsyncStorage

### Offline Sync Protocol

1. Write to local SQLite immediately (UI updates instantly).
2. Add to `sync_queue` table in SQLite with `operation`, `table`, `row_id`, `payload`, `created_at`.
3. Background sync job runs every 30 seconds when app is foregrounded.
4. On sync: push pending changes to Supabase via RPC, pull remote changes since last sync timestamp.
5. Conflict resolution: **last-write-wins** by `updated_at`. Acceptable for < 200 members with non-overlapping servant assignments.
6. Sync status visible at all times via `SyncStatusBadge`.

---

## Data Model

See [/docs/data-model.md](./data-model.md) for full ERD and field specs.

### Entities

| Entity          | Key Fields                                                                                                | Notes                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `servants`      | id (FK auth.users), name, phone, email, role, regions, push_token                                         | Linked to Supabase auth                                       |
| `persons`       | id, name, phone (unique), region, language, priority, assigned_servant_id, comments, status, paused_until | Comments private                                              |
| `attendance`    | person_id, google_event_id, event_date, present, marked_by                                                | Unique constraint on (person_id, google_event_id, event_date) |
| `follow_ups`    | person_id, servant_id, reason, action, status, snoozed_until                                              | Created by alerts or manually                                 |
| `alert_config`  | counted_event_patterns, default_threshold, priority_thresholds, notify_admin                              | Singleton                                                     |
| `cached_events` | google_event_id, title, start_time, end_time, date                                                        | Read-only for clients                                         |

---

## API Surface

See [/docs/api-design.md](./api-design.md) for full endpoint specs.

### Supabase Direct (PostgREST)

Standard CRUD on all tables via Supabase client with RLS enforcement.

### RPC Functions (Postgres)

- `get_my_group()` — servant's assigned persons with latest attendance
- `get_dashboard_stats()` — admin overview metrics
- `get_attendance_for_event(event_id, event_date)` — all attendance records for an event
- `bulk_upsert_attendance(records[])` — sync attendance from client
- `get_absence_streaks()` — current consecutive misses per person

### Edge Functions (Deno)

- `fetch-events` — pull Google Calendar events → `cached_events` (cron)
- `check-absences` — calculate streaks, create follow_ups, trigger push (runs after attendance sync)
- `send-notification` — send push via Expo Push API

---

## Screens & Navigation

See [/docs/screens.md](./screens.md) for full screen specs.

### Navigation Structure

```
Root (_layout.tsx)
├── (auth)/
│   ├── onboarding      — 3-slide carousel (first launch only)
│   └── login            — Phone OTP 2-step
│
└── (tabs)/
    ├── home             — Dashboard (admin vs servant view)
    ├── checkin/
    │   ├── index        — Today's events list
    │   └── [eventId]    — Attendance marking
    ├── people/
    │   ├── index        — Member list + search
    │   ├── quick-add    — Newcomer Quick Add form
    │   ├── register     — Full Registration form
    │   └── [personId]   — Member profile + attendance history
    └── more/
        ├── index        — Settings menu
        ├── follow-ups   — Pending follow-ups list
        ├── reports      — Admin reports
        └── settings     — Language, notifications, alert config
```

### Screen Count: 13 screens total

---

## Offline-First Strategy

| Data          | Cache Strategy                        | Sync Direction  |
| ------------- | ------------------------------------- | --------------- |
| Events        | Pull on app open + every 30min        | Server → Client |
| Member roster | Full sync on login, incremental after | Bidirectional   |
| Attendance    | Write-local-first, push on sync       | Client → Server |
| Follow-ups    | Pull from server, actions push up     | Bidirectional   |
| Alert config  | Pull on login, rarely changes         | Server → Client |

### Local SQLite Schema (mirrors Supabase with additions)

- All Supabase tables replicated locally
- `sync_queue` table for pending changes
- `sync_meta` table for last sync timestamps per table

### Sync Status Indicator

Always visible in the header:

- ✓ Synced (green)
- ⏳ Pending: N (amber, with count)
- ✗ Offline (red, with retry button)

---

## Internationalization

See [/docs/i18n.md](./i18n.md) for full translation table.

- 3 languages: English, Arabic (RTL), German
- 131+ translation keys across 8 namespaces
- Device locale detection → manual override in settings
- Cairo font covers Arabic + Latin scripts
- All directional styles use `Start`/`End` (never `Left`/`Right`)
- Date/time formatting per locale (e.g., Arabic uses Eastern Arabic numerals optionally)

---

## Notifications

See [/docs/notifications.md](./notifications.md) for full specs.

| Type               | Trigger                               | Recipient                                |
| ------------------ | ------------------------------------- | ---------------------------------------- |
| Absence Alert      | Member crosses miss threshold         | Assigned servant (+ admin if configured) |
| Welcome Back       | Previously-flagged member attends     | Assigned servant                         |
| Follow-up Reminder | Snoozed follow-up resume date reached | Assigned servant                         |
| New Assignment     | Admin reassigns a member              | Receiving servant                        |

Deep links open the relevant screen (person profile, follow-up detail).

---

## Deployment

See [/docs/deployment.md](./deployment.md) for full specs.

### Architecture

- **Supabase Cloud** (EU Frankfurt) for Postgres, Auth, Realtime, Edge Functions (v1)
- **Mobile app** distributed via TestFlight (iOS) and internal APK (Android)
- **CI/CD**: GitHub Actions → lint + typecheck + test → `supabase functions deploy` + `eas build`
- **Self-hosted fallback** (Pi5): Dockerfile + deployment.yaml ready if Supabase Cloud limits are hit

### Deployment Pattern

- Edge Functions deploy to Supabase Cloud via `supabase functions deploy` (GitHub Actions)
- Migrations deploy via `supabase db push` (GitHub Actions)
- Mobile builds via EAS Build (preview + production profiles)
- Pi5 Kubernetes deployment available as fallback (deployment.yaml + Dockerfile in `deployment.md`)

---

## Phased Roadmap

See [/docs/roadmap.md](./roadmap.md) for sprint-level detail.

| Phase | Name                        | Duration  | Key Deliverables                                                     |
| ----- | --------------------------- | --------- | -------------------------------------------------------------------- |
| 1     | Foundation                  | ✅ Done   | Scaffolding, auth, theme, i18n, DB schema, core components           |
| 2     | Person Management           | 2 weeks   | Quick Add, Full Registration, member list, search, profile           |
| 3     | Attendance                  | 2 weeks   | Google Calendar fetch, event list, check-in flow, offline sync       |
| 4     | Absence Alerts & Follow-ups | 2 weeks   | Streak calculation, alert config, follow-up CRUD, push notifications |
| 5     | Reports & Dashboards        | 1.5 weeks | Admin dashboard, servant dashboard, charts                           |
| 6     | Polish & Deploy             | 1.5 weeks | Edge cases, performance, deployment pipeline, TestFlight             |

**Total: ~9 weeks** (part-time, solo developer)

---

## Cross-References

| Document          | Path                                                 | Purpose                              |
| ----------------- | ---------------------------------------------------- | ------------------------------------ |
| Architecture      | [/docs/architecture.md](./architecture.md)           | System design, tech stack, sync flow |
| Data Model        | [/docs/data-model.md](./data-model.md)               | ERD, tables, RLS, GDPR               |
| API Design        | [/docs/api-design.md](./api-design.md)               | Endpoints, RPC, Edge Functions       |
| Screens           | [/docs/screens.md](./screens.md)                     | All screens with specs               |
| i18n              | [/docs/i18n.md](./i18n.md)                           | Translations, RTL, locale handling   |
| Notifications     | [/docs/notifications.md](./notifications.md)         | Push types, payloads, deep links     |
| Roadmap           | [/docs/roadmap.md](./roadmap.md)                     | Sprint-level phased build plan       |
| Project Structure | [/docs/project-structure.md](./project-structure.md) | Folder layout, conventions, testing  |
| Local Dev         | [/docs/local-dev.md](./local-dev.md)                 | Setup instructions, Makefile         |
| Deployment        | [/docs/deployment.md](./deployment.md)               | CI/CD, Docker, Pi5                   |
| Changelog         | [/docs/CHANGELOG.md](./CHANGELOG.md)                 | What shipped per phase               |
| Open Questions    | [/docs/open-questions.md](./open-questions.md)       | Unresolved decisions                 |
