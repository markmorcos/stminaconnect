# St. Mina Connect — Project Context

## Project name and purpose

**St. Mina Connect** is a mobile application for servants (volunteers) at St. Mina Coptic Orthodox Church in Munich, Germany. It replaces ad-hoc spreadsheets and WhatsApp threads currently used to track newcomers, attendance, and follow-ups.

The product's north star is to help servants keep in touch with every member — especially those who stop attending — so nobody quietly slips away.

### Why this exists
- Servants currently lose track of new visitors after 2–3 weeks.
- No systematic way to notice when a member has been absent for several services.
- No shared record of who has already reached out to whom after an absence.
- Church leadership has no quantitative view of member engagement.

### Who uses it
- **Admins** (priest + 1–3 church leaders): configure the system, manage servants, view all reports.
- **Servants** (5–15 volunteers): register newcomers, check members in at services, receive absence alerts, log follow-ups, view their assigned group.
- **Members are NOT users in v1.** They do not log in. Their data is captured and managed by servants.

### Scale (v1 sizing)
- ~150–200 tracked members
- ~10–15 active servants, 2–3 admins
- ~1–2 main services per week + occasional special events
- Single congregation (Munich). Multi-tenant is out of scope.

---

## Domain glossary

| Term | Definition |
|------|------------|
| **Admin** | User with full read/write access and configuration privileges. Priest or designated church leader. |
| **Servant** | Volunteer user who registers newcomers, checks members in, and follows up on absences. Has read access limited to assigned members and broader read access for event-day check-ins. |
| **Member** (or **Person**) | A registered person tracked by the app. Members do not log in. Stored in `persons` table. |
| **Newcomer** | A person in `status = new` who was registered recently and has not yet stabilized into regular attendance. |
| **Quick Add** | Five-field minimal registration flow intended to be completed by the newcomer themselves on the servant's phone. Always auto-assigns to the initiating servant. |
| **Full Registration** | Expanded registration filled by a servant, including priority, assigned servant, and private comments. Can upgrade a Quick Add record. |
| **Assigned Servant** | The servant responsible for staying in touch with a given member. Every active member has exactly one. Admins can reassign. |
| **Counted Event** | A calendar event whose attendance counts toward absence-streak calculations. Configured by admins via title patterns (e.g. "Sunday Liturgy", "Friday Vespers"). Non-counted events are visible for check-in but do not affect streaks. |
| **Attendance Record** | A row linking a Person to a calendar event with a `markedAt` timestamp, captured by a servant. |
| **Absence Streak** | Consecutive number of counted events a member has missed since their last recorded attendance at a counted event. |
| **Absence Threshold** | The streak count at which an alert fires. Default is 3; admins can set per-priority overrides. |
| **Follow-up** | A task generated when a member crosses the absence threshold. Logged with an action type (Called/Texted/Visited/No Answer/Other), optional notes, and a status. |
| **On Break** | A member-level state indicating they are traveling or otherwise known to be away. Alerts and streak calculations are suspended until a specified resume date. |
| **Return Detection** | When a flagged member attends a counted event again, the system clears the follow-up and notifies the assigned servant with a "Welcome back" push. |
| **Sync Queue** | The local outbox of mutations (check-ins, registrations, follow-up updates) made while offline, drained to Supabase when connectivity returns. |
| **Region** | Free-text neighborhood / district label on a Person record. Used for reporting breakdowns. Not validated against a list. |
| **Priority** | Enum on Person (`high`, `medium`, `low`, `very_low`) influencing absence-threshold overrides and at-risk list ordering. |

---

## Tech stack

### Versions (pinned as project baseline; bumped deliberately via change proposals)
| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 22.x LTS | Used for mobile tooling + Edge Function local dev |
| TypeScript | 5.6.x | `strict: true` everywhere |
| npm | 10.x | Chosen over pnpm/yarn to avoid Expo hoisting quirks |
| Expo SDK | 52 (latest stable at project start) | Managed workflow only |
| React Native | bundled with Expo SDK 52 | |
| Expo Router | ^4 | File-based navigation |
| Supabase CLI | latest (>= 1.200) | Local dev via Docker |
| Deno | 1.x (bundled with Supabase CLI) | Edge Functions |
| Jest | ^29 | Unit tests |
| Vitest | — | NOT used. Jest only, for RN-ecosystem parity. |

### Frontend stack (mobile)
- **Framework**: Expo (managed) + React Native + TypeScript
- **Navigation**: Expo Router (file-based)
- **i18n**: `i18next` + `react-i18next`, with RTL support via React Native's built-in `I18nManager`
- **Forms**: `react-hook-form` + `zod` (resolver)
- **Server state / data cache**: **TanStack Query (React Query) v5** — see Decision 1 below
- **Client state (UI only)**: **Zustand** — for local, non-server state (e.g. active language override, sync status banner)
- **Local database (offline)**: **`expo-sqlite`** — see Decision 2 below
- **UI kit**: **Tamagui** — see Decision 3 below
- **Push notifications**: `expo-notifications` + Expo Push API
- **Charts** (dashboards): `victory-native` (introduced in `add-admin-dashboard` change)

### Backend stack
- **BaaS**: Supabase, EU (Frankfurt) region — GDPR requirement
- **Auth**: Supabase Auth, magic-link + password; email domain allowlist configured by admin during invitation
- **Database**: Postgres (via Supabase), Row-Level Security (RLS) on every table — no exceptions
- **Server logic**: Supabase Edge Functions (Deno) for: Google Calendar polling, absence detection, push dispatch. Client-facing reads/writes go through Postgres RPC functions (SECURITY INVOKER, leveraging RLS) rather than Edge Functions where possible.
- **Scheduling**: `pg_cron` for periodic jobs (calendar sync, absence recalculation). Edge Functions triggered via cron invoker.
- **External APIs**: Google Calendar API v3 via a Google Cloud service account. No end-user OAuth. Events are cached in `events` table; we never call Calendar from the mobile client.
- **Push**: Expo Push API. Server-side dispatch only (never from client).

### Key architectural decisions

1. **TanStack Query for server state; Zustand for UI state.** React Query's cache+invalidation model is ideal for our read-heavy flows and plays well with offline persistence (via `@tanstack/query-async-storage-persister` or a custom SQLite-backed persister). Zustand handles purely local UI concerns (banner visibility, in-progress wizard state) where React Query would be overkill. Redux is rejected as over-engineered for this size.

2. **`expo-sqlite` over WatermelonDB for local storage.** We have <500 records per device; WatermelonDB's optimizations target 10k+ record datasets. `expo-sqlite` is first-party, requires no custom model decorators, and we can build our sync layer exactly to match Supabase's shape. Trade-off: we write our own sync logic (which we'd end up customizing with WatermelonDB anyway).

3. **Tamagui for UI.** Strongest RTL story among RN UI kits, excellent perf (compile-time optimizations), theme tokens trivially support our trilingual aesthetic needs. Alternatives considered: NativeWind (class-based, great DX but weaker component primitives), React Native Paper (Material-only, less flexible).

4. **Postgres RPC + RLS over Edge Functions for CRUD.** RLS enforces access rules in one place; using RPCs keeps queries centralized without the cold-start latency of Edge Functions for user-facing reads.

5. **Last-write-wins conflict resolution.** Two servants rarely edit the same record simultaneously. CRDTs are over-engineering. We record `updatedAt` + `updatedBy` on every mutable row so conflicts are at least auditable after the fact.

6. **No realtime in v1.** Pull-based sync only. Realtime subscriptions add battery cost, quota concerns, and complexity. Revisit in v2.

---

## Architecture patterns

### Mobile (monorepo: single `apps/mobile` for v1; no workspace yet)
```
src/
├── app/                      # Expo Router screens; file-based routing
│   ├── (auth)/               # Unauthenticated group: login, magic-link
│   ├── (tabs)/               # Authenticated tabs: home, check-in, group, more
│   ├── person/[id].tsx       # Person detail
│   └── _layout.tsx
├── components/               # Reusable presentational components
│   ├── ui/                   # Tamagui-based primitives (Button, TextField, etc.)
│   └── domain/               # Domain-specific (PersonRow, AttendanceRoster, ...)
├── features/                 # Feature-scoped hooks, screens-logic, local state
│   ├── registration/
│   ├── attendance/
│   ├── follow-up/
│   └── ...
├── services/
│   ├── api/                  # Supabase client wrappers — ONLY place screens talk to
│   ├── db/                   # expo-sqlite schema + query helpers
│   ├── sync/                 # sync queue + conflict resolution
│   └── notifications/        # push registration + handlers
├── i18n/
│   ├── index.ts              # i18next init
│   └── locales/{en,ar,de}/
├── stores/                   # Zustand stores (UI state only)
├── types/                    # Shared TS types (generated from Supabase + hand-authored)
└── utils/                    # Pure utilities (date, phone, etc.)
```

**Enforced boundaries:**
- Screens/components never import `@supabase/supabase-js` directly. All network calls go through `services/api/*`.
- Screens never import `expo-sqlite` directly. All local DB access goes through `services/db/*`.
- Sync logic lives in `services/sync/*`. Screens interact with TanStack Query hooks; those hooks decide whether to hit `services/api` (online) or `services/db` (offline) with the sync layer as mediator.

### Backend (Supabase project)
```
supabase/
├── migrations/               # Numbered SQL migrations (timestamped)
├── functions/                # Edge Functions (Deno)
│   ├── calendar-sync/
│   ├── absence-detect/
│   └── push-dispatch/
├── seed.sql                  # Local dev seed data
└── config.toml
```

**Database conventions:**
- `snake_case` for tables and columns.
- Every mutable table has `id uuid pk default gen_random_uuid()`, `created_at timestamptz`, `updated_at timestamptz`, `created_by uuid`, `updated_by uuid`.
- Soft deletes via `archived_at timestamptz` (no hard deletes, for audit).
- RLS enabled on every table. Default-deny; explicit policies per role.
- RPC functions use `SECURITY INVOKER` so RLS applies. `SECURITY DEFINER` only for intentional bypass (documented inline).

---

## Code conventions

### Naming
- Files: `kebab-case.ts` / `kebab-case.tsx`. React components inside use `PascalCase` names.
- React components: `PascalCase`.
- Functions, variables: `camelCase`.
- Types/interfaces: `PascalCase`. Prefer `type` aliases unless you need declaration merging.
- Constants: `SCREAMING_SNAKE_CASE` only for true compile-time constants; otherwise `camelCase`.
- SQL: `snake_case` everywhere.
- i18n keys: `dot.notation.in.kebab-case` by feature: `registration.quick-add.phone-label`.

### Error handling
- Mobile: surface user-facing errors as toasts with i18n keys; log technical details via `services/logger` (which wraps `console` in dev, Sentry in prod — Sentry added in `harden-and-polish`).
- Never swallow errors silently. If you catch, re-throw or report.
- Supabase/RPC errors pass through a typed result envelope: `{ data, error }`. Hooks surface `error` to the UI; screens render an error state component.
- Validation errors are inline form errors; network/server errors are toasts + an inline retry control where applicable.

### Logging
- No `console.log` checked into shipped code. Use `services/logger`.
- Structured fields, not string concatenation.
- Never log PII (names, phone numbers, comments).

### Formatting & linting
- Prettier (default config, single quotes, no semicolons — actually: **use semicolons**, matches RN ecosystem norms).
- ESLint with `@react-native/eslint-config` + `@typescript-eslint`.
- `typecheck` runs in CI on every change.

---

## Testing conventions

### What gets tested
- **Unit tests (Jest)**: every utility, every reducer/selector/store, every custom hook, every Edge Function handler.
- **Integration tests (Jest against local Supabase)**: every RPC function, every RLS policy combination (admin reads all, servant reads own assignments, servant cannot read unassigned).
- **Business-logic tests**: absence detection, streak calculation, auto-assignment, sync conflict resolution — these are the highest-risk units and must be unit-tested with table-driven cases covering edge scenarios (timezone boundaries, partial streaks, members going on break mid-streak, etc.).
- **Component tests (React Native Testing Library)**: for form components with non-trivial validation (Quick Add, Full Registration, Follow-up log form). Not every component needs one — reserve for components with logic.

### What does NOT get tested in v1
- End-to-end mobile flows (Detox/Maestro). Out of scope; revisit post-launch.
- Visual regression.

### Coverage expectations
- **80%+ coverage** on `services/sync`, `services/db`, `services/api`, all Edge Functions, all RPC functions.
- **60%+ coverage** on features (form logic etc.).
- No coverage gate on `components/ui/*` — Tamagui primitives are tested upstream.

### Test data
- Local Supabase seed script populates realistic data: 5 servants, 20 members across languages/regions/priorities, 8 weeks of attendance, 3 open follow-ups, 1 member on break. Exposed via `make seed`.

---

## i18n conventions

- **Supported languages**: English (`en`), Arabic (`ar`), German (`de`). All three shipped from day one.
- **Default**: device locale; fall back to `en`. User can override in Settings (persisted).
- **RTL**: Arabic only. Triggered via `I18nManager.forceRTL()` at app init; requires app reload on language switch — handled with a user-visible confirmation.
- **Key structure**: `feature.subfeature.element` (e.g. `attendance.check-in.save-button`).
- **Placeholders**: always named (`{{count}}`), never positional.
- **Plurals**: use `i18next`'s built-in plural rules (including Arabic's 6-form plurals).
- **Dates & numbers**: `Intl.DateTimeFormat` / `Intl.NumberFormat` with active locale. Never format dates by hand.
- **Member data**: stored as entered. We do not transliterate. A member named "ماريا" is stored exactly that way, regardless of UI language.
- **Translation ownership**: English is the source of truth. Arabic + German are added by a human reviewer before each release. Missing keys fall through to English with a dev-mode warning.

---

## Git conventions

### Branching
- `main` is always green.
- Feature branches: `feat/<short-description>` from `main`.
- One change proposal ≈ one feature branch (though can be multiple if broken into several PRs for reviewability).

### Commit messages
- Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`, `perf:`.
- Scope optional but encouraged: `feat(attendance): add offline check-in roster`.
- Subject in imperative, ≤72 chars.
- Body explains the *why* when non-obvious.

### Commit size
- Atomic. Each commit leaves the project green (typecheck + lint + tests pass).
- One OpenSpec task ≈ one commit, in most cases.

### PR rules
- PR description references the change folder: `Implements openspec/changes/add-quick-add-registration/`.
- PR checklist includes: tests added/updated, `openspec validate` passes, translations updated if new user-visible strings.

---

## Documentation rules

- **Specs are canon.** If behavior diverges from the archived spec, fix one or the other — no drift.
- **Inline comments**: only for non-obvious business logic (e.g. absence-streak calculation reference), never for what well-named code already says.
- **JSDoc / TSDoc**: required on exported functions in `services/*` (because they are the internal API contract).
- **READMEs**: root README covers setup + Makefile commands. Subfolders get a README only when they contain non-trivial conventions (e.g. `supabase/functions/README.md`).
- **ADRs**: significant architectural decisions go in `design.md` of the relevant change proposal — not in a separate `docs/adr/` folder. Archived specs preserve the decision history.

---

## Development environment

### Prerequisites
- Docker Desktop (for local Supabase)
- Node 22.x LTS
- Xcode (iOS simulator) and/or Android Studio (emulator)
- Expo Go app on a physical device (recommended for trilingual + push testing)

### Environments
| Env | Supabase | Expo |
|-----|----------|------|
| `local` | Supabase CLI (Docker) | Expo dev server, `.env.local` |
| `production` | Hosted Supabase project, EU (Frankfurt) region | EAS Build profiles (`preview`, `production`) |

**No staging environment in v1.** Preview builds distributed via TestFlight (iOS) and EAS internal distribution (Android) point at production Supabase for UAT. This is acceptable at our scale; revisit once there are more than 15 servants.

### Environment variables (`.env.example`)
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (backend only, never exposed to client)
- `GOOGLE_CALENDAR_ID`
- `GOOGLE_SERVICE_ACCOUNT_JSON` (backend only)
- `EXPO_PUBLIC_SENTRY_DSN` (added in `harden-and-polish`)
- `EXPO_PUBLIC_APP_ENV` (`local` | `production`)

**No URL, API key, or endpoint is ever hardcoded.** Anything environment-dependent goes through `.env` and is read via a typed `config.ts` module that throws on missing values.

### Makefile targets
| Target | Purpose |
|--------|---------|
| `make dev-up` | Start Supabase CLI + Expo dev server |
| `make dev-down` | Stop Supabase |
| `make migrate-new name=<name>` | Create a new numbered migration |
| `make migrate-up` | Apply migrations to local DB |
| `make migrate-down` | Roll back last migration (local only) |
| `make seed` | Apply `supabase/seed.sql` + seed Auth users |
| `make test` | Run all Jest tests (mobile + functions + integration) |
| `make test-coverage` | Same with coverage report |
| `make lint` | ESLint + Prettier check |
| `make typecheck` | `tsc --noEmit` on mobile + functions |
| `make deploy-functions env=production` | Deploy Edge Functions |
| `make deploy-migrations env=production` | Apply migrations to prod |

---

## Change-completion definition (ready to archive)

A change proposal may be archived **only when all of the following are true**:
1. Every task in `tasks.md` is checked off.
2. Every scenario in the spec delta is verified (automated where possible, manual steps documented otherwise).
3. `make test`, `make lint`, `make typecheck` all pass on `main`.
4. Test coverage for modified areas meets the thresholds above.
5. `openspec validate <change>` passes.
6. User (the solo developer/reviewer) has committed everything and the PR is merged.
7. Translations for all three languages are in place for any new user-visible strings.
