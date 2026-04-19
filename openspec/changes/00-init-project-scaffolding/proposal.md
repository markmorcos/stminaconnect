## Why

We need a reproducible foundation before any feature work begins: Expo app, local Supabase via CLI, Makefile, environment variable template, linting, typechecking, Jest configuration, and a seed-data script stub. Getting this right once avoids rework later — every subsequent change depends on being able to `make dev-up` and `make test` on a fresh clone.

This change also pins our exact tool versions and establishes the repo conventions (folder layout, commit style, PR template). No user-visible functionality is delivered.

## What Changes

- **ADDED** `setup` capability: reproducible local dev environment (Expo + local Supabase via Docker), Makefile, env var template, linting, typechecking, test runner, CI-ready scripts.
- No other capabilities are introduced.

## Impact

- **Affected specs:** `setup` (new)
- **Affected code (preview, no code written in this change yet):** root `package.json`, `apps/mobile/` (Expo app), `supabase/` (CLI config + empty migrations folder), `Makefile`, `.env.example`, `.eslintrc.cjs`, `tsconfig.json`, `jest.config.ts`, `supabase/seed.sql` (empty), `.github/pull_request_template.md`.
- **Breaking changes:** none (greenfield).
- **Migration needs:** none.
- **Depends on:** nothing (this is change #1).
