# St. Mina Connect

A mobile app for **St. Mina Coptic Orthodox Church, Munich** that helps servants track newcomers, record attendance, and follow up when members stop attending.

---

## What It Does

| Feature | Description |
|---|---|
| **Newcomer Registration** | Servant hands phone to visitor — they fill in 5 fields (Quick Add). Servant can later complete a Full Registration with priority, comments, and servant assignment. |
| **Attendance Tracking** | Events are pulled from Google Calendar. Servants mark members present/absent after each service. Works offline; changes sync when connectivity returns. |
| **Absence Alerts** | When a member misses N consecutive counted events (configurable), the assigned servant receives a push notification and an in-app follow-up task. |
| **Follow-up Workflow** | Servant logs the action taken (called, texted, visited), adds notes, or snoozes the alert. "Welcome back" notification when an absent member returns. |
| **Reports & Dashboards** | Admin sees attendance trends, at-risk member list, newcomer funnel, and region breakdown. Servant sees their group, pending follow-ups, and recent newcomers. |

---

## Who Uses It

| Role | Description |
|---|---|
| **Admin** (Priest / Leader) | Full access. Manages servants, alert rules, and sees all reports. |
| **Servant** (Volunteer) | Registers newcomers, takes attendance, manages follow-ups for their assigned group. |

No member-facing role in v1. Members never log in.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Mobile | React Native + Expo (managed workflow) |
| Navigation | Expo Router (file-based, deep-link ready) |
| Backend | Supabase (Postgres + Auth + Edge Functions, EU Frankfurt) |
| Local DB | expo-sqlite + drizzle-orm (offline-first, Phase 3+) |
| Server state | TanStack Query |
| Client state | Zustand |
| Forms | React Hook Form + Zod |
| i18n | i18next + react-i18next (EN / AR / DE, RTL) |
| Font | Cairo (Arabic + Latin) |
| Icons | @expo/vector-icons (Ionicons) |
| Push | Expo Push API → APNs / FCM (Phase 4+) |

---

## Languages

The app supports three languages, selectable by the user:

- 🇬🇧 **English**
- 🇩🇪 **German** (default — church is in Munich)
- 🇸🇦 **Arabic** (RTL layout, Cairo font diacritics)

The Quick Add screen adapts its greeting in real-time when the newcomer selects their language.

---

## Architecture Overview

```
┌─────────────────────┐     ┌─────────────────────────┐     ┌──────────────────┐
│  Expo App (RN)       │────▶│  Supabase (EU Frankfurt) │────▶│  Google Calendar │
│                      │◀────│  Postgres + Auth         │◀────│  (Service Acct)  │
│  SQLite (local)      │     │  Edge Functions (Deno)   │     └──────────────────┘
│  TanStack Query      │     │  Row-Level Security       │
│  Zustand + i18next   │     │                          │     ┌──────────────────┐
└─────────────────────┘     └─────────────────────────┘────▶│  Expo Push API   │
                                                             └──────────────────┘
```

**Key data flows:**
1. **Events**: Google Calendar → Edge Function (cron 30 min) → `cached_events` → Client
2. **Attendance**: Client SQLite → sync queue → Supabase `attendance` (offline-first)
3. **Absence Alerts**: Edge Function reads attendance → calculates streaks → creates follow-ups → sends push notifications
4. **Auth**: Phone OTP → Supabase Auth → JWT persisted in AsyncStorage

---

## Data Model

| Table | Purpose |
|---|---|
| `servants` | App users (linked to Supabase Auth) |
| `persons` | Church members (no auth account) |
| `attendance` | One row per person per event |
| `follow_ups` | Absence alerts and manual follow-up tasks |
| `cached_events` | Google Calendar events (read-only) |
| `alert_config` | Singleton: counted event patterns + absence thresholds |

All tables are protected by **Row-Level Security** (RLS). Servants see their own data plus all persons; admins see everything. Comments on persons are filtered at the app layer — only the assigned servant and admins can read them.

---

## Project Structure

```
stminaconnect/
├── app/                    # Expo Router screens
│   ├── (auth)/             # Login, Onboarding
│   └── (tabs)/             # Home, Check In, People, More
├── src/
│   ├── api/queries/        # Supabase query functions
│   ├── components/         # Reusable UI components
│   ├── hooks/              # TanStack Query hooks
│   ├── stores/             # Zustand global state
│   ├── theme/              # Design tokens (colors, typography, spacing)
│   ├── types/              # Shared TypeScript types
│   ├── utils/              # Validation, phone formatting
│   └── i18n/               # Translation files (en, ar, de)
├── supabase/
│   ├── migrations/         # Postgres migrations (numbered)
│   └── functions/          # Deno Edge Functions
├── docs/                   # Living documentation
└── __tests__/              # Jest tests
```

---

## Local Development

**Prerequisites**: Node 18+, Expo CLI, Supabase CLI

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY

# Start local Supabase
supabase start
supabase db reset   # runs migrations + seed

# Start Expo
npx expo start
```

**Useful commands:**

```bash
make dev-up        # Start Supabase + Expo
make test          # Run Jest
make typecheck     # TypeScript type check
make lint          # ESLint
make seed          # Reset DB + seed
make migrate-new   # Create new migration
```

See [`docs/local-dev.md`](docs/local-dev.md) for full setup instructions including auth user creation.

---

## Build Phases

| Phase | Name | Status |
|---|---|---|
| 1 | Foundation (auth, theme, DB schema, i18n) | ✅ Done |
| 2 | Person Management (Quick Add, Full Registration, member list) | ✅ Done |
| 3 | Attendance & Offline Sync | Planned |
| 4 | Absence Alerts & Follow-ups | Planned |
| 5 | Reports & Dashboards | Planned |
| 6 | Polish, CI/CD, Deployment | Planned |

See [`docs/roadmap.md`](docs/roadmap.md) for sprint-level detail on each phase.

---

## Documentation

| Document | Purpose |
|---|---|
| [`docs/master-plan.md`](docs/master-plan.md) | Single source of truth for the entire project |
| [`docs/architecture.md`](docs/architecture.md) | System design, sync flow, tech decisions |
| [`docs/data-model.md`](docs/data-model.md) | ERD, table definitions, RLS policies |
| [`docs/api-design.md`](docs/api-design.md) | PostgREST endpoints, RPC functions, Edge Functions |
| [`docs/screens.md`](docs/screens.md) | All 14 screens with specs and mockups |
| [`docs/roadmap.md`](docs/roadmap.md) | Phased build plan with per-phase file lists |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | What shipped in each phase |

---

## Privacy & Security

- **Authentication**: Phone OTP only — no passwords
- **Authorization**: Postgres RLS enforced on every query
- **GDPR**: Data hosted in EU Frankfurt. Admin can hard-delete a member (cascades to all related records). Comments visible only to assigned servant + admins.
- **Offline encryption**: Relies on device-level storage encryption (Android Full Disk / iOS Data Protection)
- **Service role key**: Used only in Edge Functions (server-side). Never shipped to the client app.

---

## License

Internal church tool. Not for public distribution.
