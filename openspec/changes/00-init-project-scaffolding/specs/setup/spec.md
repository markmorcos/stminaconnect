## ADDED Requirements

### Requirement: Reproducible local environment

The repository SHALL allow a developer with only the documented prerequisites installed to go from `git clone` to a running local Expo dev server plus local Supabase instance using a single Makefile command.

#### Scenario: Fresh clone bootstrap

- **GIVEN** a machine with Docker Desktop, Node 22.x, Xcode or Android Studio, and the Supabase CLI installed
- **AND** no other project dependencies installed
- **WHEN** the developer runs `git clone <repo>`, `cd` into it, `npm install`, and then `make dev-up`
- **THEN** the local Supabase stack starts (Postgres, Auth, Studio)
- **AND** the Expo dev server starts with a QR code printed
- **AND** no error messages are emitted
- **AND** the total time from `make dev-up` to ready is under 5 minutes (Supabase's first-run Docker pull dominates this)

#### Scenario: Dev shutdown is clean

- **GIVEN** `make dev-up` is currently running
- **WHEN** the developer runs `make dev-down`
- **THEN** the local Supabase containers stop
- **AND** no orphaned Docker containers remain
- **AND** subsequent `make dev-up` starts cleanly (no stale state error)

### Requirement: Environment variable template

The repository SHALL provide a `.env.example` file listing every environment variable used anywhere in the project, with a comment on each line naming the change that introduced it and whether it is required in that environment.

#### Scenario: Example env is complete

- **GIVEN** the current state of the repository after this change
- **WHEN** a developer copies `.env.example` to `.env.local` and fills in the required values
- **THEN** `make dev-up` succeeds without any "missing env var" errors from `config.ts`
- **AND** `.env.example` contains a line for every variable read by `config.ts` or the Supabase CLI or any Makefile target

#### Scenario: Missing required var surfaces clearly

- **GIVEN** `.env.local` is missing `EXPO_PUBLIC_SUPABASE_URL`
- **WHEN** the Expo dev server starts and loads the app
- **THEN** `config.ts` throws a descriptive error naming the missing variable
- **AND** the error is shown in the Metro bundler output and a clear on-device screen

### Requirement: Unified test, lint, typecheck commands

The project SHALL expose `make test`, `make lint`, and `make typecheck` targets that run the full respective suite across both the mobile app and Supabase functions, and each SHALL exit non-zero on any failure.

#### Scenario: Test command runs mobile and function tests together

- **GIVEN** a freshly scaffolded repo from this change
- **WHEN** the developer runs `make test`
- **THEN** Jest runs the mobile sanity test
- **AND** if any Edge Function test is present (none yet in this change), it runs as well
- **AND** the command exits with status 0

#### Scenario: Typecheck catches a bad type

- **GIVEN** the developer introduces a type error in `apps/mobile/src/config.ts`
- **WHEN** they run `make typecheck`
- **THEN** the command exits with status 1
- **AND** the error location is printed

### Requirement: Commit and PR conventions are enforced

The repository SHALL enforce Conventional Commits via a `commit-msg` hook and SHALL run Prettier + ESLint on staged files via a `pre-commit` hook.

#### Scenario: Non-conventional commit is rejected

- **GIVEN** staged changes in a working tree
- **WHEN** the developer runs `git commit -m "update stuff"`
- **THEN** the commit is rejected with a message explaining Conventional Commit format

#### Scenario: Conventional commit is accepted

- **GIVEN** staged changes in a working tree
- **WHEN** the developer runs `git commit -m "chore: add baseline scaffolding"`
- **THEN** the commit succeeds
- **AND** any staged file that fails Prettier or ESLint causes the commit to fail until fixed

### Requirement: No hardcoded URLs or secrets

No source file SHALL contain a hardcoded Supabase URL, anon key, Google credentials, or any other environment-specific value. All such values SHALL be read from environment variables via the `config` module.

#### Scenario: Grep proves no hardcoded Supabase URLs

- **GIVEN** the repository at the completion of this change
- **WHEN** someone greps the codebase for `supabase.co`, `supabase.in`, `localhost:54321`, or any `eyJ...` JWT prefix
- **THEN** no matches are found outside of `.env.example` and documentation
