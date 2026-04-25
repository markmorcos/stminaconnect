# St. Mina Connect

Mobile app for the St. Mina Coptic Orthodox Church (Munich) — built with Expo, Supabase, and TypeScript. See `openspec/project.md` for the full project context and roadmap.

## Quick start (Expo Go in ~60 seconds)

### Prerequisites

- **Node 20 LTS** (or newer; pinned via `engines` in `package.json`)
- **Docker Desktop** running locally (Supabase CLI uses it for the local stack)
- **Expo Go** installed on your iOS or Android device — [iOS App Store](https://apps.apple.com/app/expo-go/id982107779) / [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)

### Boot

```bash
git clone <repo-url> stminaconnect
cd stminaconnect

# 1. Install JS deps + verify Docker is reachable
make install

# 2. Copy the env template (one-time)
cp .env.example .env.local

# 3. Boot the local Supabase stack
make dev-up
# ↳ Note the printed `API URL` and `anon key`. Paste them into .env.local under
#   EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.

# 4. Start the Expo dev server and scan the QR with Expo Go
make expo-start
```

### Local Supabase URLs

`make dev-up` boots a Docker stack and prints something like:

```
        API URL: http://127.0.0.1:54321
   GraphQL URL: http://127.0.0.1:54321/graphql/v1
        DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
    Studio URL: http://127.0.0.1:54323
       anon key: eyJhbGciOiJI...
service_role key: eyJhbGciOiJI...
```

Copy `API URL` → `EXPO_PUBLIC_SUPABASE_URL`, `anon key` → `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`. The `service_role key` is for Edge Functions only — never bundle it into the client.

## Make targets

```bash
make help            # list targets with descriptions
make install         # npm ci + Docker check
make dev-up          # supabase start
make dev-down        # supabase stop
make migrate-up      # supabase migration up
make migrate-down    # supabase db reset (destructive)
make migrate-new NAME=<name>
make seed            # placeholder until phase 4
make lint            # eslint
make typecheck       # tsc --noEmit
make test            # jest
make test-coverage   # jest --coverage
make expo-start      # npx expo start
```

## Project layout

```
app/                  Expo Router routes
src/
  components/         Shared UI
  features/           One folder per capability (registration/, attendance/, ...)
  services/
    api/              Supabase wrappers
    notifications/    NotificationService + implementations
    sync/             Offline sync queue (phase 12+)
    db/               expo-sqlite helpers (phase 12+)
  hooks/
  i18n/
  state/
  types/
  utils/
supabase/             Local Supabase project (config, migrations, functions)
tests/                Jest test suites
openspec/             Spec-driven development workspace (proposals, specs, archives)
```

## Conventions

- **TypeScript strict everywhere.** No `any` without a `// TODO(strict): …` comment.
- **Conventional Commits.** `feat:`, `fix:`, `chore:`, `test:`, `docs:`, etc.
- **Pre-commit hook** runs `lint-staged` (lint + format on staged files) and `npm run typecheck`.

For everything else, see `openspec/project.md`.
