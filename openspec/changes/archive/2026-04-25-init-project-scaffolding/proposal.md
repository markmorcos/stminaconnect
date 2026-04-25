## Why

We need a working Expo Go-runnable codebase before any feature work. A solo developer's iteration speed depends on a clean scaffold: TypeScript strict, ESLint/Prettier wired, Jest configured, Supabase CLI booting locally, a Makefile that hides command verbosity, and a smoke test that proves the Supabase client can be initialized. Doing this once now prevents weeks of small frictions later.

## What Changes

- **ADDED** Expo (managed workflow, latest stable SDK) project with TypeScript 5.x strict, Expo Router, React Native Paper, and the agreed folder layout (`app/`, `src/components/`, `src/features/`, `src/services/`, etc.).
- **ADDED** `package.json` with pinned versions for the core dependencies named in `project.md` §5 (Expo Router, Paper, Supabase JS, expo-sqlite, expo-localization, expo-notifications, i18next, Zustand, TanStack Query, RHF, Zod).
- **ADDED** ESLint + Prettier configs, husky pre-commit hook running `lint` + `typecheck`.
- **ADDED** Jest config (jest-expo preset) + React Native Testing Library; one passing smoke test.
- **ADDED** Supabase CLI configuration (`supabase/config.toml`) and local boot working via `make dev-up`.
- **ADDED** `.env.example` listing every variable that any later phase will need (placeholders only).
- **ADDED** `Makefile` with the targets enumerated in `project.md` §6 (sans dev-build targets, which arrive in phase 16).
- **ADDED** A placeholder `app/index.tsx` screen that:
  - Imports the configured Supabase client.
  - Logs a "Supabase client initialized" line to the dev console.
  - Renders an i18n-free placeholder ("St. Mina Connect — initializing").
- **ADDED** A README quick-start: clone → install → `make dev-up` → `npx expo start` → scan QR with Expo Go.
- **ADDED** `assets/` folder structure (`assets/branding/`, `assets/icons/`, `assets/fonts/`, `assets/images/`) with placeholder app icon and splash. Real brand assets land in `add-brand-assets`.
- **ADDED** `expo-font`, `expo-splash-screen`, and `react-native-svg` installed (used by `setup-design-system` and `add-brand-assets`).
- **ADDED** Bundle identifier and Android package id configured in `app.json`: `tech.morcos.stminaconnect` (subject to user confirmation; default chosen).
- **ADDED** `expo.userInterfaceStyle = "automatic"` so dark mode (introduced in `setup-design-system`) works on day one.

## Impact

- **Affected specs**: introduces capability `dev-tooling`.
- **Affected code**: brand-new repo scaffold. No prior code to migrate.
- **Breaking changes**: none — first change.
- **Migration needs**: none.
- **Expo Go compatible**: yes. The placeholder screen is a plain React component using zero native modules beyond what's bundled in Expo Go.
- **Dependencies**: none — this change is the prerequisite for all others.
