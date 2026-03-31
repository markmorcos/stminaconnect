# Project Structure

## Directory Layout

```
stminaconnect/
├── app/                          # Expo Router file-based routes
│   ├── _layout.tsx               # Root layout: providers, auth gate, fonts
│   ├── +not-found.tsx            # 404 fallback
│   ├── (auth)/                   # Unauthenticated screens
│   │   ├── _layout.tsx           # Stack navigator for auth
│   │   ├── login.tsx             # Phone OTP login
│   │   └── onboarding.tsx        # 3-slide carousel
│   └── (tabs)/                   # Authenticated tab navigation
│       ├── _layout.tsx           # Tab bar with 4 tabs
│       ├── home.tsx              # Dashboard
│       ├── checkin/
│       │   ├── _layout.tsx       # Stack navigator
│       │   ├── index.tsx         # Event list
│       │   └── [eventId].tsx     # Attendance marking
│       ├── people/
│       │   ├── _layout.tsx       # Stack navigator
│       │   ├── index.tsx         # Member list + search
│       │   ├── quick-add.tsx     # Quick Add form
│       │   ├── register.tsx      # Full Registration form
│       │   └── [personId].tsx    # Member profile
│       └── more/
│           ├── _layout.tsx       # Stack navigator
│           ├── index.tsx         # Menu hub
│           ├── follow-ups.tsx    # Follow-up list
│           ├── follow-ups/
│           │   └── [id].tsx      # Follow-up detail
│           ├── reports.tsx       # Admin reports
│           └── settings.tsx      # Settings + alert config
│
├── src/
│   ├── theme/                    # Design system tokens
│   │   ├── colors.ts             # Coptic Blue, Heritage Gold, semantic
│   │   ├── typography.ts         # Cairo font sizes, weights, line heights
│   │   ├── spacing.ts            # 4px base unit scale
│   │   ├── radius.ts             # Border radius scale
│   │   ├── shadows.ts            # Shadow presets (sm, md, lg)
│   │   └── index.ts              # Barrel export
│   │
│   ├── components/               # Reusable UI components
│   │   ├── Button.tsx            # primary, secondary, destructive, ghost
│   │   ├── Card.tsx              # Card with optional accent border
│   │   ├── Input.tsx             # Labeled input with error state
│   │   ├── AttendanceChip.tsx    # present/absent/at_risk badges
│   │   ├── SyncStatusBadge.tsx   # ✓ synced / ⏳ pending / ✗ offline
│   │   ├── PhoneInput.tsx        # Phone with country code picker (Phase 2)
│   │   ├── SelectPicker.tsx      # Dropdown select (Phase 2)
│   │   ├── SearchBar.tsx         # Search input with clear (Phase 2)
│   │   ├── FilterChips.tsx       # Horizontal filter chip row (Phase 2)
│   │   ├── EmptyState.tsx        # Illustration + text + CTA (Phase 6)
│   │   └── SkeletonLoader.tsx    # Loading placeholder (Phase 6)
│   │
│   ├── hooks/                    # Custom React hooks
│   │   ├── useAuth.ts            # Auth state + methods (wraps authStore)
│   │   ├── useSync.ts            # Sync engine control
│   │   ├── usePersons.ts         # TanStack Query hooks for persons CRUD
│   │   ├── useAttendance.ts      # TanStack Query hooks for attendance
│   │   ├── useFollowUps.ts       # TanStack Query hooks for follow-ups
│   │   ├── useEvents.ts          # TanStack Query hooks for cached events
│   │   └── useNotifications.ts   # Push token registration + deep linking
│   │
│   ├── stores/                   # Zustand global state
│   │   ├── authStore.ts          # Session, profile, onboarding
│   │   ├── syncStore.ts          # Sync status, pending count
│   │   └── settingsStore.ts      # Language, color scheme
│   │
│   ├── api/                      # Supabase client + data layer
│   │   ├── supabase.ts           # Supabase client init with AsyncStorage
│   │   └── queries/              # Query functions (fetchers for TanStack Query)
│   │       ├── persons.ts
│   │       ├── attendance.ts
│   │       ├── followUps.ts
│   │       ├── events.ts
│   │       └── dashboard.ts
│   │
│   ├── db/                       # Local SQLite (offline-first)
│   │   ├── schema.ts             # drizzle-orm table definitions
│   │   ├── client.ts             # expo-sqlite connection
│   │   ├── sync.ts               # Sync engine (queue + push/pull)
│   │   └── migrations/           # Local schema migrations
│   │
│   ├── i18n/                     # Internationalization
│   │   ├── index.ts              # i18next config, detection, persistence
│   │   ├── en.json               # English (131+ keys)
│   │   ├── ar.json               # Arabic (RTL)
│   │   └── de.json               # German
│   │
│   ├── utils/                    # Pure utility functions
│   │   ├── validation.ts         # Zod schemas (person, attendance, etc.)
│   │   ├── dates.ts              # Date formatting per locale
│   │   ├── phone.ts              # E.164 formatting + validation
│   │   └── streaks.ts            # Absence streak calculation (client-side)
│   │
│   └── types/                    # Shared TypeScript types
│       └── index.ts              # All entity types + enums
│
├── supabase/
│   ├── config.toml               # Supabase project config
│   ├── migrations/               # SQL migration files (numbered)
│   │   ├── 00001_initial_schema.sql
│   │   ├── 00002_rls_policies.sql
│   │   ├── 00003_rpc_functions.sql        # Phase 2-3
│   │   └── 00004_absence_functions.sql    # Phase 4
│   ├── functions/                # Deno Edge Functions
│   │   ├── fetch-events/
│   │   │   └── index.ts          # Google Calendar → cached_events
│   │   ├── check-absences/
│   │   │   └── index.ts          # Streak calc → follow-ups → push
│   │   └── send-notification/
│   │       └── index.ts          # Expo Push API wrapper
│   ├── tests/                    # Integration tests (Deno)
│   │   ├── rls_test.ts           # RLS policy tests
│   │   └── rpc_test.ts           # RPC function tests
│   └── seed.sql                  # Dev seed data
│
├── docs/                         # Living documentation
│   ├── master-plan.md            # Top-level project plan
│   ├── architecture.md           # System design, tech stack, sync flow
│   ├── data-model.md             # ERD, tables, RLS, GDPR
│   ├── api-design.md             # Endpoints, RPC, Edge Functions
│   ├── screens.md                # All screens with specs
│   ├── i18n.md                   # Translations, RTL, locale handling
│   ├── notifications.md          # Push types, payloads, deep links
│   ├── roadmap.md                # Phased build plan
│   ├── project-structure.md      # This file
│   ├── local-dev.md              # Setup instructions
│   ├── deployment.md             # CI/CD, Docker, Pi5
│   ├── open-questions.md         # Unresolved decisions
│   └── CHANGELOG.md              # What shipped per phase
│
├── assets/                       # Static assets
│   └── images/                   # App icon, splash, illustrations
│
├── __tests__/                    # Jest test files (mirrors src/)
│   ├── utils/
│   │   ├── validation.test.ts
│   │   ├── phone.test.ts
│   │   └── streaks.test.ts
│   ├── hooks/
│   │   └── useSync.test.ts
│   └── db/
│       └── sync.test.ts
│
├── .github/
│   └── workflows/
│       ├── ci.yml                # Lint + typecheck + test on PR/push
│       └── deploy.yml            # Deploy Edge Functions on merge to main
│
├── app.config.ts                 # Expo configuration
├── tsconfig.json                 # TypeScript config with path aliases
├── package.json                  # Dependencies and scripts
├── Makefile                      # Dev commands
├── .env.example                  # Environment variable template
├── .prettierrc                   # Prettier config (semi, singleQuote: false, 90 chars)
└── .gitignore
```

## Naming Conventions

| What       | Convention                     | Example                                                  |
| ---------- | ------------------------------ | -------------------------------------------------------- |
| Components | PascalCase, named exports      | `Button.tsx` → `export function Button()`                |
| Screens    | kebab-case files (Expo Router) | `quick-add.tsx`, `[personId].tsx`                        |
| Hooks      | camelCase, `use` prefix        | `usePersons.ts` → `export function usePersons()`         |
| Stores     | camelCase, `use` prefix        | `authStore.ts` → `export const useAuthStore`             |
| Utils      | camelCase                      | `validation.ts` → `export const personSchema`            |
| Types      | PascalCase                     | `Person`, `Servant`, `FollowUp`                          |
| i18n keys  | dot.separated.namespaces       | `people.quickAddGreeting`                                |
| Migrations | numbered prefix                | `00003_rpc_functions.sql`                                |
| Commits    | conventional                   | `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:` |
| Branches   | kebab-case                     | `phase-2-person-crud`, `fix-rtl-layout`                  |

## Path Aliases (tsconfig.json)

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@app/*": ["./app/*"]
    }
  }
}
```

Usage: `import { Button } from "@/components/Button"`

## Testing Strategy

### Unit Tests (Jest)

**What to test**:

- Zod validation schemas (valid + invalid inputs)
- Utility functions (date formatting, phone validation, streak calculation)
- Sync engine logic (queue, push, pull, conflict resolution)
- Zustand store actions

**Where**: `__tests__/` directory mirroring `src/`

**Run**: `make test` or `npx jest`

### Integration Tests (Deno / Supabase)

**What to test**:

- RLS policies (can servant X do Y?)
- RPC functions (correct results with known data)
- Edge Functions (expected behavior with mocked external APIs)

**Where**: `supabase/tests/`

**Run**: `deno test supabase/tests/` (against local Supabase)

### Coverage Target

- **80%+ on business logic** (validation, streaks, sync engine)
- Components are NOT unit tested — validated via manual testing
- RLS and RPC tested via integration tests against local Supabase

### What NOT to test

- React Native component rendering (complex to set up, low ROI for this app size)
- Supabase client library internals
- Expo framework behavior
- Third-party library functionality

## RTL Guidelines

| Do                                            | Don't                          |
| --------------------------------------------- | ------------------------------ |
| `paddingStart: 16`                            | `paddingLeft: 16`              |
| `marginEnd: 8`                                | `marginRight: 8`               |
| `textAlign: 'auto'`                           | `textAlign: 'left'`            |
| `flexDirection: 'row'` (system flips)         | Hardcode `row-reverse` for RTL |
| Use `I18nManager.isRTL` for conditional logic | Assume LTR                     |
| Test every screen in Arabic after changes     | Ship without RTL testing       |
