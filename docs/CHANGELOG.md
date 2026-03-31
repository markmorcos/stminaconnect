# Changelog

## Phase 2 — Person Management (2026-03-31)

### Added
- `babel.config.js` with `babel-plugin-module-resolver` for `@/` path aliases
- `.eslintrc.js` — ESLint configured with TypeScript + React + React Hooks plugins
- `jest.config.js` — Jest configured with jest-expo preset
- `supabase/migrations/00003_rpc_functions.sql` — 4 RPC functions: `get_my_group`, `get_dashboard_stats`, `get_attendance_for_event`, `bulk_upsert_attendance`
- `src/utils/validation.ts` — Zod schemas: `quickAddSchema`, `fullRegistrationSchema`
- `src/utils/phone.ts` — `normalizePhone`, `formatPhoneDisplay`, `isValidE164` utilities
- `src/api/queries/persons.ts` — Supabase CRUD for persons
- `src/api/queries/servants.ts` — Supabase queries for servants
- `src/hooks/usePersons.ts` — TanStack Query hooks: `usePersons`, `usePerson`, `useCreatePerson`, `useUpdatePerson`, `useDeletePerson`
- `src/hooks/useServants.ts` — TanStack Query hooks: `useServants`, `useServant`
- `src/components/PhoneInput.tsx` — Phone input with country code picker (DE/EG/US/UK/AT/CH)
- `src/components/SelectPicker.tsx` — Modal-based dropdown select
- `src/components/SearchBar.tsx` — Debounced search input with clear button
- `src/components/FilterChips.tsx` — Horizontal scrolling filter chips
- `app/(tabs)/people/quick-add.tsx` — Quick Add screen (5 fields, newcomer-facing, language-aware greeting)
- `app/(tabs)/people/register.tsx` — Full Registration screen (all fields + upgrade Quick Add)
- `app/(tabs)/people/[personId].tsx` — Member profile: info, comments (gated), attendance/follow-up placeholders, pause/delete actions
- `__tests__/utils/validation.test.ts` — 16 unit tests for Zod schemas
- `__tests__/utils/phone.test.ts` — 15 unit tests for phone utilities
- `README.md` — Project overview (phase-independent)

### Changed
- `app/(tabs)/people/index.tsx` — Full implementation: search, filter chips (All/My Group/New/Active/Inactive), FlatList, FAB with Quick Add / Register options
- `app/(tabs)/home.tsx` — Live Recent Newcomers list, My Group count, admin stat tiles, quick action row
- `src/i18n/en.json`, `ar.json`, `de.json` — Added 30+ keys for Phase 2 features
- `package.json` — Added devDependencies: jest-expo, @testing-library/react-native, eslint stack, babel-plugin-module-resolver; fixed `lint` script
- `supabase/seed.sql` — Expanded with 20-person seed dataset (commented, awaiting auth users)

## Planning Review (2026-04-01)

### Updated
- Cross-verified all 12 docs against actual codebase
- Fixed tech stack references: NativeWind → inline StyleSheet, Phosphor → @expo/vector-icons
- Fixed deployment architecture: Supabase Cloud for v1, Pi5 as fallback
- Resolved all open questions (OQ-1 through OQ-14) with concrete decisions
- Added implementation details to roadmap: file lists, database changes, commit breakdowns per phase
- Documented Phase 1 gaps to address in Phase 2: ESLint, Jest, Babel path aliases

## Phase 1 — Foundation (2026-03-30)

### Added
- Expo project with TypeScript + Expo Router (file-based routing)
- Theme system: colors (Coptic Blue + Heritage Gold), Cairo typography, spacing, shadows, radius
- Cairo font loading (Regular, Medium, SemiBold, Bold)
- i18next with EN/AR/DE translations + RTL support for Arabic
- Supabase Auth with phone OTP login
- Auth guard (redirect unauthenticated to login)
- Onboarding flow (3 swipeable screens)
- Core UI components: Button, Card, Input, SyncStatusBadge, AttendanceChip
- Tab navigation: Home, Check In, People, More
- Supabase migrations: all tables, enums, indexes, RLS policies
- Seed data template
- Zustand stores: auth, sync, settings
- Dev tooling: .env.example, Makefile, Prettier config
- Documentation: local-dev, architecture, data-model, project-structure
