# St. Mina Connect

Mobile app for the St. Mina Coptic Orthodox Church (Munich) — built with Expo, Supabase, and TypeScript. See `openspec/project.md` for the full project context and roadmap.

> **Workflow:** from phase 16 onward, daily development runs in a custom **dev client** built via EAS rather than the public Expo Go app. Expo Go is the legacy path — it still works for read-only smoke tests but is not the supported flow. Setup, build, and install instructions live in [`docs/dev-build.md`](docs/dev-build.md).

## Quick start (dev client)

### Prerequisites

- **Node 20 LTS** (or newer; pinned via `engines` in `package.json`)
- **Docker Desktop** running locally (Supabase CLI uses it for the local stack)
- **`eas-cli`** globally (`npm i -g eas-cli`) and an Expo account
- A **dev client** installed on your phone — see [`docs/dev-build.md`](docs/dev-build.md) for the one-time `make build-dev-ios` / `make build-dev-android` step

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

# 4. Start the Expo dev server for the installed dev client
make expo-start-dev-client
# (Legacy Expo Go path: `make expo-start` — works for read-only smoke tests
#  but no longer supported for daily work.)
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

### Sign-in (magic link)

Magic link is the only sign-in path. In dev:

1. Sign-in screen → enter email → tap **Send magic link**.
2. Open Mailpit at http://127.0.0.1:54324. The latest message contains a `stminaconnect://auth/callback?code=…` URL.
3. Tap the link **on the same device** as the dev client. The OS opens the app, the callback exchanges the PKCE code, and you land on home.

`additional_redirect_urls` in `supabase/config.toml` lists `stminaconnect://auth/callback`. Troubleshooting: see [`docs/dev-build.md`](docs/dev-build.md) § 5.

### Seed accounts (after `make seed`)

`make seed` resets the dev fixture every time it runs. Each seed user is signed in via magic link — request one from the sign-in screen and tap it from Mailpit.

| Email                | Role    |
| -------------------- | ------- |
| `priest@stmina.de`   | admin   |
| `servant1@stmina.de` | servant |
| `servant2@stmina.de` | servant |
| `servant3@stmina.de` | servant |
| `servant4@stmina.de` | servant |

The fixture also inserts 20 sample persons across regions and languages so
the persons list and profile screens have content to render.

## Make targets

```bash
make help            # list targets with descriptions
make install         # npm ci + Docker check
make dev-up          # supabase start
make dev-down        # supabase stop
make migrate-up      # supabase migration up
make migrate-down    # supabase db reset (destructive)
make migrate-new NAME=<name>
make seed            # populate the local DB with the dev fixture
make lint            # eslint
make typecheck       # tsc --noEmit
make test            # jest
make test-coverage   # jest --coverage
make expo-start      # npx expo start (legacy Expo Go entry; prefer expo-start-dev-client)
make expo-start-dev-client  # npx expo start --dev-client (canonical from phase 16+)
make build-dev-ios   # eas build --profile development --platform ios
make build-dev-android  # eas build --profile development --platform android
make build-preview   # eas build --profile preview --platform all
make build-prod      # eas build --profile production --platform all (gated)
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
