# St. Mina Connect — Project Context

> Single source of truth for AI-assisted spec-driven development. Read this before generating any change proposal.

## 1. Project Identity

- **Name**: St. Mina Connect
- **Audience**: Servants (volunteers) and clergy at **St. Mina Coptic Orthodox Church**, Munich, Germany.
- **Purpose**: Help servants register newcomers, track attendance against the church's published events, detect pastoral risk (extended absences), and coordinate follow-ups.
- **Scale**: <200 active members, <15 servants, ~3 events per week. Free-tier infrastructure must suffice.
- **Distribution strategy**: internal first (TestFlight + APK during dev/preview), public store release planned. Store assets — icons, screenshots, copy in EN/AR/DE, privacy nutrition labels — are produced in the dedicated `prepare-store-listings` change before submission.
- **Solo, part-time development**. Bias every decision toward simplicity and managed services.

## 1a. Brand identity

The visual language is Coptic Orthodox tradition expressed through a contemporary mobile aesthetic — never skeuomorphic, never "churchy." Reference points: Coptic crosses, Byzantine/Coptic typography influence, traditional liturgical color associations (deep liturgical red, vestment gold, indigo informational accents, warm off-whites and deep charcoals).

- **Palette philosophy** (final values pinned in `setup-design-system` and verified in `add-brand-assets`):
  - Primary — deep liturgical red (~`#8B1E2D` in light mode).
  - Secondary — warm gold (~`#C9A961`).
  - Accent — muted indigo for informational states.
  - Neutrals — warm off-whites and deep charcoals; never pure black/white.
- **Typography pairing**: Inter (Latin, EN/DE) + IBM Plex Sans Arabic (Arabic). Both humanist sans-serif families, free, OFL-licensed; chosen for visual coherence across scripts without auto-translating the Arabic identity.
- **App icon**: a stylized Coptic-cross-derived modern glyph, NOT photo-realistic religious iconography.
- **Capability spec**: see `openspec/specs/branding/` (populated when `add-brand-assets` is archived).

## 1b. Design system principle (NON-NEGOTIABLE)

> **All UI is built from the design-system capability. Feature changes never introduce ad-hoc styles, colors, font sizes, or spacing values.**

The design system (introduced in `setup-design-system`, before any feature change) defines tokens (colors, typography, spacing, radii, elevation, motion) and a base component library (`Text`, `Button`, `Input`, `Avatar`, `Badge`, `EmptyState`, etc.). Feature changes consume these — they MUST NOT redefine them. If a feature needs a value the design system doesn't provide, the gap is filed against the design system, not patched inline.

Themes ship light + dark from day one. Every token has light + dark variants. The active theme respects the OS color scheme by default, with a manual override in Settings. WCAG AA contrast is verified for every text-on-surface pairing.

## 1c. Accessibility baseline

- WCAG AA contrast for body text and AA Large for large text — enforced by an automated test suite from `add-brand-assets` onward.
- Touch targets ≥ 44pt (iOS) / 48pt (Android).
- Full RTL support (verified per-component, not just per-screen).
- Screen reader navigation order verified on iOS (VoiceOver) and Android (TalkBack); see `docs/a11y-audit.md` populated by `harden-and-polish`.
- Dynamic type / system font scaling respected.
- Reduce-motion respected (animations fall back to instant transitions).

## 1d. GDPR baseline

- Data hosted in EU only (Supabase Frankfurt region) — required.
- Privacy Policy + Terms gate first-launch via the consent flow introduced in `add-gdpr-compliance`. Acceptance is logged with version + timestamp.
- Data export (Article 15) and hard-erasure (Article 17) flows are mandatory for both members (admin-initiated) and servants (self-service).
- An audit log records sensitive actions (member erasure, role changes, data exports, consent events).
- The app performs no analytics, no third-party tracking, no advertising — disclosed in the Privacy Policy and on the iOS Privacy nutrition label.
- See `openspec/specs/compliance/` (populated when `add-gdpr-compliance` is archived) for the full requirements.

## 1e. No member photos in v1

Member profiles do not display photos. Profile screens (and list rows) use the design-system `Avatar` component which renders initials over a deterministically-derived background color (FNV-1a hash of `person.id` modulo 8 against `tokens.avatarPalette`). The `persons` schema has no `photo_url` column. Adding photos later is a forward-compatible additive migration plus storage/upload UI plus moderation tooling — explicitly out of scope for v1.

## 2. Top-Level Constraint: Expo Go-First

This is the most important architectural rule of the project and supersedes other preferences when they conflict.

> **Every change before `switch-to-development-build` (phase 20) MUST be fully buildable, runnable, and end-to-end testable in Expo Go.**

Rationale: solo developer iteration speed. EAS builds are slow and fragile; Expo Go's QR-code reload loop keeps the inner loop tight.

### What this means in practice

- **Allowed in early phases**: `@supabase/supabase-js`, i18next, React Hook Form + Zod, expo-sqlite, expo-localization, expo-notifications **for local notifications only**, NativeWind, Recharts-equivalent libraries that work in Expo Go.
- **Forbidden in early phases**: WatermelonDB, native Google Sign-In, custom config plugins, remote push notifications via `getExpoPushTokenAsync`, anything requiring `expo-dev-client`.
- **Mocked in early phases**: real push notifications. The app uses a `NotificationService` interface; before phase 20, the implementation is a mock dispatcher (Postgres `notifications` table + in-app banner). Phase 21 swaps in the real implementation.
- **Self-check rule**: before finalizing any change before phase 20, verify `Can this be tested end-to-end in Expo Go?`. If no, mock the incompatible part or move the work into the dev-build phase.

## 3. Domain Glossary

| Term                        | Definition                                                                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Member**                  | A person known to the church (newcomer, regular attendee, occasional attendee). Members do not log into the app.                                          |
| **Servant**                 | An authenticated app user with volunteer-level permissions. Registers newcomers, marks attendance, performs follow-ups.                                   |
| **Admin**                   | A privileged servant (priest / church leader) who can configure alerts, manage other servants, see all reports, reassign members.                         |
| **Quick Add**               | A 5-field newcomer registration flow optimized for the newcomer to fill in on the servant's phone. Auto-assigned to the initiating servant.               |
| **Full Registration**       | A longer registration form with priority, assigned servant, and private comments. Filled in by a servant.                                                 |
| **Counted Event**           | A church event whose Google Calendar entry matches an admin-configured title pattern (e.g. "Sunday Liturgy"). Only counted events affect absence streaks. |
| **Absence Streak**          | The number of consecutive counted events a member has missed. Reset to zero on attendance.                                                                |
| **Absence Threshold**       | The streak length at which an alert fires. Default 3. May be configured per priority level.                                                               |
| **Follow-up**               | A pastoral action (Called/Texted/Visited/No Answer/Other) logged against a member, optionally with notes and a status (Completed/Snoozed).                |
| **On Break**                | A status indicating a member is travelling or otherwise temporarily unavailable. Pauses absence-streak evaluation until `pausedUntil`.                    |
| **Counted Event Pattern**   | A case-insensitive substring or simple wildcard pattern matched against `eventTitle` to flag events as counted.                                           |
| **Sync Queue**              | The local table holding pending writes that have not yet reached Supabase.                                                                                |
| **Notification Dispatcher** | The runtime implementation behind `NotificationService` — mock (early phases) or real Expo Push (phase 21+).                                              |

## 4. Users & Roles

- **Admin**: full access. Manages servants, configures regions and counted-event patterns, sets thresholds, sees all reports, reassigns members.
- **Servant**: registers newcomers; checks in any member at events (with their assigned-list pre-loaded); receives absence alerts (in-app while in Expo Go phases, real push later); manages own follow-ups; sees own group dashboard.
- **No member-facing role in v1.** Members do not authenticate.

## 5. Tech Stack (Pinned)

| Layer               | Choice                                                                                      | Notes                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Runtime (mobile)    | **Expo SDK 50+** (latest stable at session time), React Native, TypeScript 5.x, Node 20 LTS | Managed workflow; Expo Go-first                                                                                                                                                                                                                                                                                                                                                      |
| Navigation          | **Expo Router**                                                                             | File-based                                                                                                                                                                                                                                                                                                                                                                           |
| Forms               | **React Hook Form + Zod**                                                                   |                                                                                                                                                                                                                                                                                                                                                                                      |
| State               | **Zustand** for ephemeral UI state; **TanStack Query** for server-state caching             | Zustand picked for ergonomic minimalism; TanStack Query for caching + sync UX. Both Expo Go-compatible.                                                                                                                                                                                                                                                                              |
| UI substrate        | **React Native Paper, theme overridden**                                                    | Picked for accessibility defaults, RTL support, Material conventions familiar to non-tech-savvy users, and zero native-module surprises in Expo Go. Paper's _theme_ is fully overridden by our brand tokens (see `setup-design-system`); features consume our design-system components, never Paper directly. NativeWind/Tamagui considered but Paper's a11y/RTL/Expo-Go-compat win. |
| Fonts               | **Inter** (Latin) + **IBM Plex Sans Arabic** (Arabic) via `expo-font`                       | Loaded in `setup-design-system`. `Text` resolves family by `i18n.language`.                                                                                                                                                                                                                                                                                                          |
| Icons               | **lucide-react-native**                                                                     | Stroke-style, modern, Expo Go compatible.                                                                                                                                                                                                                                                                                                                                            |
| Animations          | **react-native-reanimated**                                                                 | Used in `harden-and-polish` for motion. Expo Go compatible from SDK 50+.                                                                                                                                                                                                                                                                                                             |
| Haptics             | **expo-haptics**                                                                            | Used in `harden-and-polish` for tactile feedback.                                                                                                                                                                                                                                                                                                                                    |
| Theming             | **Light + dark** mandatory                                                                  | Tokens define both; system default + manual override.                                                                                                                                                                                                                                                                                                                                |
| i18n                | **i18next + react-i18next**, **expo-localization** for device locale                        | EN/AR/DE day one                                                                                                                                                                                                                                                                                                                                                                     |
| RTL                 | `I18nManager` + Paper RTL primitives                                                        | First Arabic switch requires app reload (documented)                                                                                                                                                                                                                                                                                                                                 |
| Local DB            | **expo-sqlite**                                                                             | Decided. NOT WatermelonDB.                                                                                                                                                                                                                                                                                                                                                           |
| Local notifications | **expo-notifications** (local channel only)                                                 | Real push deferred to phase 21                                                                                                                                                                                                                                                                                                                                                       |
| Charts              | **react-native-chart-kit** (or `victory-native@^36` if Paper integration is cleaner)        | Final pick justified in `add-admin-dashboard/design.md`. Must be Expo Go-compatible.                                                                                                                                                                                                                                                                                                 |
| Backend             | **Supabase** (EU/Frankfurt region)                                                          | Free tier sufficient                                                                                                                                                                                                                                                                                                                                                                 |
| Auth                | Supabase Auth (email/password + magic link)                                                 | No Google Sign-In in v1                                                                                                                                                                                                                                                                                                                                                              |
| DB                  | Postgres + RLS                                                                              | All client access via RPC functions                                                                                                                                                                                                                                                                                                                                                  |
| Server logic        | Supabase Edge Functions (Deno)                                                              | TypeScript                                                                                                                                                                                                                                                                                                                                                                           |
| Calendar            | Google Calendar via service account                                                         | Service account JSON in Edge Function secrets                                                                                                                                                                                                                                                                                                                                        |
| Push (later)        | Expo Push API                                                                               | Phase 21+ only                                                                                                                                                                                                                                                                                                                                                                       |
| Local dev           | Supabase CLI (Docker)                                                                       | `supabase start`                                                                                                                                                                                                                                                                                                                                                                     |
| Build (later)       | EAS Build                                                                                   | Introduced in phase 20                                                                                                                                                                                                                                                                                                                                                               |
| Tests               | Jest + React Native Testing Library; Deno test for Edge Functions                           | 80%+ coverage on business logic                                                                                                                                                                                                                                                                                                                                                      |
| Lint/format         | ESLint + Prettier                                                                           | Pinned configs in scaffold                                                                                                                                                                                                                                                                                                                                                           |
| CI                  | Deferred — local-only checks during early phases                                            | Considered in phase 23                                                                                                                                                                                                                                                                                                                                                               |

Versions are committed to `package.json` / `Makefile` during phase 1; later changes can bump but never silently downgrade.

## 6. Architecture Patterns

These patterns are non-negotiable. Every change must respect them.

1. **Service-first networking**. All mobile network calls go through `services/api/*` modules. Components never call `supabase.from(...)` directly.
2. **`NotificationService` interface**. All outbound notifications go through `services/notifications/NotificationService`. The runtime implementation is selected by config (`mock` vs `real`). Edge Functions also dispatch through a server-side equivalent.
3. **RPC-only client access**. From the mobile client, all database mutations and most reads happen through Postgres RPC functions, never direct table access. RLS policies are defense-in-depth, not the only line.
4. **Offline writes go through the sync queue**. From phase 13 onward, writes are recorded into `local_sync_queue` first; the queue worker pushes to Supabase when online. Reads go to expo-sqlite first, with TanStack Query falling through to Supabase on cache miss.
5. **One source of truth for events**. Events come from Google Calendar via the `sync-calendar-events` Edge Function. The app never creates events.
6. **Auto-generated audit fields**. Every persistable row has `createdAt`, `updatedAt`, `createdBy`. Mutations set these via DB triggers or RPC defaults — never relied on from the client.
7. **i18n-or-die**. No user-facing string is hardcoded. Every label has a translation key. Tests catch missing keys at CI time.
8. **Privacy by RLS**. The `comments` field on `persons` is readable only to the assigned servant and admins, enforced both at RLS and at the RPC layer.
9. **Design system is the only UI source**. Every UI primitive comes from `src/design/components/`. Feature code has no `StyleSheet` literal colors, no hardcoded font sizes, no hardcoded spacing values. Tokens are imported from `src/design/tokens.ts`.
10. **Light + dark from day one**. The `ThemeProvider` is mounted at the app root before any feature mounts. No screen builds for one mode only.
11. **Consent gates app access**. From `add-gdpr-compliance` onward, the auth route guard checks the user's latest consent acceptance against the published policy/terms versions; mismatch redirects to the consent flow before any authenticated screen renders.

## 7. Code Conventions

- **TypeScript everywhere**. `strict: true`. No `any` without `// TODO(strict): ...` justification.
- **Folder structure** (mobile):
  ```
  app/                  # Expo Router routes
  src/
    components/         # Shared UI
    features/           # One folder per capability (registration/, attendance/, ...)
    services/
      api/              # Supabase wrappers
      notifications/    # NotificationService + implementations
      sync/             # Offline sync queue
      db/               # expo-sqlite helpers
    hooks/
    i18n/
      locales/          # en.json, ar.json, de.json
    state/              # Zustand stores
    types/              # Shared TS types
    utils/
  supabase/
    migrations/
    functions/
    seed.sql
  tests/
  ```
- **Naming**: `camelCase` for vars/functions, `PascalCase` for components and types, `kebab-case` for filenames except components (PascalCase). DB tables and columns: `snake_case`.
- **Error handling**: throw typed errors from services; catch at the screen boundary; surface user-friendly i18n'd messages via Paper's `Snackbar`. Never `console.log` errors — use a thin `logger` module that respects `__DEV__`.
- **No silent failures**. Every catch logs; every user-visible failure has a translated message.

## 8. Testing Conventions

- **Unit tests** for: business-logic utilities (streak calc, conflict resolution, pattern matching), Zustand stores, `NotificationService` mock implementation.
- **Integration tests** for: Edge Functions (against local Supabase), RPC functions and RLS policies, sync queue end-to-end.
- **Component tests** for: critical flows (Quick Add, Check In, Follow-up logging) using React Native Testing Library.
- **80%+ coverage** on `src/services/**` and `src/features/**/logic/**`. UI presentational code excluded.
- **All tests run locally**. No production credentials in tests. CI is post-MVP.
- Each change's `tasks.md` includes explicit testing tasks.

## 9. i18n Conventions

- Languages: **`en`, `ar`, `de`** — present from phase 5 onward.
- **Fallback chain**: device locale → manual override (persisted) → `en`.
- **Translation keys**: dot-notation, namespace per feature: `auth.login.title`, `registration.quickAdd.firstName`.
- **No string interpolation in components** — pass through `t('key', { name })`.
- **RTL**: detected from active language. First switch into Arabic toggles `I18nManager.forceRTL(true)` and shows a one-time "App will reload" dialog. Users informed in `add-i18n-foundation/design.md`.
- **Member data is stored as-entered**. Names, comments, and free-text fields are not translated.
- **Pluralization**: i18next built-in plural rules. Arabic plurals tested explicitly.

## 10. Git Conventions

- **Conventional commits**: `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`, `perf:`, `style:`. Optional scope: `feat(attendance): ...`.
- **One change folder = one PR (or one merge of many small commits)**. Each commit must leave the project green.
- **Branch naming**: `change/<change-id>` (e.g. `change/add-quick-add-registration`).
- **`main` is always deployable**.

## 11. Documentation Rules

- Inline comments only for non-obvious _why_ — never _what_.
- **Specs reflect reality**. After applying a change, the spec under `openspec/specs/` is updated as part of the archive step. No drift allowed.
- **README** is a quick-start ("how to run in Expo Go in 60 seconds"), not a spec.
- **Runbooks** (deployment, backup) introduced in phase 23.

## 12. Environments

| Env          | Backend                                      | Mobile                                                  |
| ------------ | -------------------------------------------- | ------------------------------------------------------- |
| `local`      | Supabase CLI (Docker) on `localhost:54321`   | Expo Go via LAN dev server                              |
| `production` | Hosted Supabase project, EU/Frankfurt region | EAS-built apps via TestFlight + internal APK (phase 23) |

There is **no staging environment** in v1. Production deploys are gated on local verification + manual test.

## 13. Environment Variables

- Client-visible vars use `EXPO_PUBLIC_` prefix.
- Server secrets live in Supabase Edge Function secrets.
- `.env.example` is committed and complete; `.env` is gitignored.
- Required vars defined in `init-project-scaffolding`.

## 14. Quality Gates per Change

A change is ready to archive only when:

1. All `tasks.md` items checked off.
2. All scenarios in the spec delta verified (manual or automated).
3. `openspec validate <change>` passes.
4. Test suite green and coverage threshold met.
5. Manual verification performed **in Expo Go** (changes 1–19) or in a dev build (changes 20+).
6. User has committed and reviewed.

Until each of these is true, the change stays in `openspec/changes/`.

## 15. Roadmap

The full execution order. Changes are applied one at a time; each must be archived before the next begins. Phase numbers in this document refer to this list.

1. **`init-project-scaffolding`** — Stand up the Expo + Supabase CLI workspace, Makefile targets, and lint/test config.
2. **`setup-design-system`** — Define design tokens, mount the theme provider, and ship the base component library (light + dark).
3. **`add-brand-assets`** — Produce the app icon, splash screen, and logo, and verify brand colors against WCAG AA contrast.
4. **`add-servant-auth`** — Wire Supabase Auth (email/password + magic link) and role-based access for servants and admins.
5. **`add-i18n-foundation`** — Bring in i18next, RTL handling, EN/AR/DE translations, and a language switcher.
6. **`add-person-data-model`** — Create the `persons` and `servants` tables with RLS, basic CRUD, and seed data.
7. **`add-quick-add-registration`** — Ship the 5-field newcomer form with auto-assignment to the initiating servant.
8. **`add-full-registration`** — Add the full registration form with priority, assigned servant, and private comments.
9. **`add-servant-account-management`** — Self-service account screen for display-name and password changes; admin RPC for editing other servants' display names (UI consumer in phase 16).
10. **`add-notification-service-mock`** — Define the `NotificationService` interface and ship the mock in-app dispatcher.
11. **`add-google-calendar-sync`** — Add the Edge Function that polls Google Calendar, the `events` table, and counted-event matching.
12. **`add-attendance-online-only`** — Build the check-in screen and persist attendance against events on the online path.
13. **`add-offline-sync-with-sqlite`** — Mirror reads in expo-sqlite, queue offline writes, and resolve conflicts on reconnect.
14. **`add-absence-detection`** — Add admin-configurable thresholds, streak calculation, and alert generation through the mock dispatcher.
15. **`add-followups-and-on-break`** — Add the follow-up flow, the on-break state, and return-to-attendance detection.
16. **`add-admin-dashboard`** — Build the admin overview: trends, at-risk list, registration funnel, and region breakdown.
17. **`add-servant-dashboard`** — Build the servant home: my group, pending follow-ups, recent newcomers.
18. **`harden-and-polish`** — Add error/empty/loading states, accessibility audit, motion, and performance pass.
19. **`add-gdpr-compliance`** — Add the consent flow, data export (Article 15), hard-erasure (Article 17), and audit log.
20. **`switch-to-development-build`** — Move to expo-dev-client, EAS build profiles, and a custom URL scheme.
21. **`replace-mock-with-real-push`** — Swap in the real Expo Push dispatcher with token lifecycle and quiet hours.
22. **`prepare-store-listings`** — Produce store assets, copy in EN/AR/DE, screenshots, and iOS privacy nutrition labels.
23. **`setup-production-deployment`** — Provision the production Supabase project, deployment scripts, backups, and runbook.
