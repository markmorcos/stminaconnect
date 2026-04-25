# Tasks — init-project-scaffolding

Each task is a single commit. Order matters.

## 1. Repo bootstrap

- [x] 1.1 Run `npx create-expo-app@latest` with TypeScript template; commit as `chore: bootstrap expo app`
- [x] 1.2 Convert to Expo Router (install `expo-router`, configure `app/_layout.tsx` and `app/index.tsx`); commit
- [x] 1.3 Switch `tsconfig.json` to `strict: true`, add path aliases (`@/*` → `src/*`); commit
- [x] 1.4 Adopt the folder layout from `project.md` §7 — create empty `src/components`, `src/features`, `src/services/{api,notifications,sync,db}`, `src/hooks`, `src/i18n`, `src/state`, `src/types`, `src/utils` with `.gitkeep` files

## 2. Lint, format, hooks

- [x] 2.1 Install ESLint with `eslint-config-expo` + Prettier; configure `.eslintrc.js`, `.prettierrc`
- [x] 2.2 Add `npm run lint`, `npm run format`, `npm run typecheck` scripts
- [x] 2.3 Install `husky` + `lint-staged`; pre-commit runs `lint-staged` (lint + format on staged) and `npm run typecheck`

## 3. Test infrastructure

- [x] 3.1 Install Jest + jest-expo preset + RNTL + `@testing-library/jest-native`
- [x] 3.2 Configure `jest.config.js` with jest-expo preset, coverage thresholds (lines: 80, branches: 70 — adjusted lower until business logic exists)
- [x] 3.3 Add a passing example test under `tests/smoke/example.test.ts` to confirm the test runner works
- [x] 3.4 Add the **Supabase smoke test** under `tests/smoke/supabaseClient.test.ts` — imports `src/services/api/supabase.ts`, asserts construction does not throw

## 4. UI kit baseline

- [x] 4.1 Install `react-native-paper` + a `PaperProvider` in `app/_layout.tsx` (theming overridden in `setup-design-system`)
- [x] 4.2 Install `expo-localization` (used in `add-i18n-foundation`)
- [x] 4.3 Install `expo-sqlite` (used in `add-offline-sync-with-sqlite`)
- [x] 4.4 Install `expo-notifications` (used in `add-notification-service-mock`)
- [x] 4.5 Install `i18next`, `react-i18next` (used in `add-i18n-foundation`)
- [x] 4.6 Install `zustand`, `@tanstack/react-query`, `react-hook-form`, `zod`
- [x] 4.7 Install `@supabase/supabase-js`, `@react-native-async-storage/async-storage` (auth-storage polyfill — used in `add-servant-auth`)
- [x] 4.8 Install `expo-font` (custom fonts loaded in `setup-design-system`)
- [x] 4.9 Install `expo-splash-screen` (configured in `setup-design-system` and `add-brand-assets`)
- [x] 4.10 Install `react-native-svg` (used by Logo component in `add-brand-assets`)

## 4b. Assets folder structure

- [x] 4b.1 Create `assets/` with subfolders: `assets/branding/`, `assets/icons/`, `assets/fonts/`, `assets/images/`. Each gets a `.gitkeep`.
- [x] 4b.2 Add a placeholder app icon at `assets/icons/icon-placeholder.png` (any 1024×1024 solid-color PNG with white text "STMC") — replaced in `add-brand-assets`.
- [x] 4b.3 Add a placeholder splash at `assets/icons/splash-placeholder.png` — same idea, 1284×2778, brand-color background, app-name text — replaced in `add-brand-assets`.

## 4c. Bundle identifier + names

- [x] 4c.1 Configure `app.json`:
  - `expo.name = "St. Mina Connect"`.
  - `expo.slug = "st-mina-connect"`.
  - `expo.version = "0.1.0"` (bumped in `switch-to-development-build` and `setup-production-deployment`).
  - `expo.ios.bundleIdentifier = "tech.morcos.stminaconnect"`.
  - `expo.android.package = "tech.morcos.stminaconnect"`.
  - `expo.icon = "./assets/icons/icon-placeholder.png"`.
  - `expo.splash = { image: "./assets/icons/splash-placeholder.png", resizeMode: "contain", backgroundColor: "#FBF8F4" }`.
  - `expo.userInterfaceStyle = "automatic"` (enables dark mode in `setup-design-system`).

## 5. Supabase client + env

- [x] 5.1 Create `src/services/api/supabase.ts` exporting a configured `supabase` client. Reads `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Uses AsyncStorage for auth-token persistence.
- [x] 5.2 Create `.env.example` with **all** vars enumerated in `project.md` §13 (placeholders for ones that aren't used until later, with `# unused until phase N` comments)
- [x] 5.3 Add `.env*` (except `.env.example`) to `.gitignore`

## 6. Supabase local stack

- [x] 6.1 `supabase init` — generates `supabase/config.toml`, `supabase/migrations/`, `supabase/functions/`
- [x] 6.2 Verify `supabase start` boots cleanly; persist a one-paragraph note in `README.md` showing the printed local URLs the dev should put into `.env.local`

## 7. Makefile

- [x] 7.1 Create `Makefile` with these targets:
  - `install` — `npm ci` plus a Docker-presence check
  - `dev-up` — `supabase start`
  - `dev-down` — `supabase stop`
  - `migrate-up` — `supabase migration up`
  - `migrate-down` — `supabase db reset` (documented as destructive)
  - `migrate-new` — wraps `supabase migration new $(NAME)`
  - `seed` — placeholder echo for now (real seed lands in phase 4)
  - `deploy-functions` — placeholder echo
  - `deploy-migrations` — placeholder echo
  - `lint` — `npm run lint`
  - `typecheck` — `npm run typecheck`
  - `test` — `npm test`
  - `test-coverage` — `npm test -- --coverage`
  - `expo-start` — `npx expo start`
  - **NOT** `expo-start-dev-client` (added in phase 16)

## 8. Placeholder app

- [x] 8.1 Replace generated `app/index.tsx` with a Paper `Surface` displaying "St. Mina Connect — initializing"
- [x] 8.2 In `app/_layout.tsx`, on mount, log "Supabase client initialized" — proving the client import is wired
- [x] 8.3 Verify on iOS via Expo Go (scan QR) — screen renders, no warnings

## 9. README

- [x] 9.1 Write quick-start: prerequisites (Node 20, Docker, Expo Go on phone), `make install`, `make dev-up`, `npx expo start`, scan QR
- [x] 9.2 Document env var copy step (`cp .env.example .env.local`)

## 10. Verification

- [x] 10.1 `make lint` clean
- [x] 10.2 `make typecheck` clean
- [x] 10.3 `make test` passes
- [x] 10.4 Manual: app opens in Expo Go on real device, placeholder screen visible, console shows "Supabase client initialized"
- [x] 10.5 `openspec validate init-project-scaffolding` passes
