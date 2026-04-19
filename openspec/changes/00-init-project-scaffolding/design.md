## Context

Greenfield repo — only OpenSpec folder exists today. We need the smallest possible scaffolding that still enforces every convention declared in `project.md`, so that the first feature change (`add-servant-auth`) can focus entirely on feature work and not on tooling decisions.

The constraint shaping this change: the app will be developed by a solo developer with intermittent attention. Fast `make dev-up` → coding loop is critical. Anything that takes more than one command to spin up will erode productivity.

## Goals

- `git clone` → `make dev-up` → working Expo dev server + local Supabase in under 5 minutes on a clean machine (after prerequisites are installed).
- Typecheck, lint, test all runnable via a single Makefile command, all passing on an empty project.
- All conventions in `project.md` are enforced by tooling (ESLint rules, `tsconfig` `strict: true`, Prettier on save).
- `.env.example` is complete and has every variable the project will ever need listed — even if some are unused in this change (added with placeholder / noted as "introduced in change X").

## Non-Goals

- No Supabase schema. No auth setup. No feature code. No UI.
- No EAS configuration yet (deferred to `setup-production-deployment`).
- No CI pipeline (GitHub Actions) yet — the Makefile targets must be CI-ready, but no workflow file is checked in yet. That lands with `setup-production-deployment`.
- No Sentry / observability wiring (deferred to `harden-and-polish`).

## Decisions

1. **Single-package repo, not a monorepo.** The mobile app lives at the repo root inside `apps/mobile/`, and the Supabase project at `supabase/`. We don't use pnpm workspaces or Nx. Rationale: the shared TypeScript types between mobile and Edge Functions are small enough to either duplicate or codegen from Supabase — not worth the tooling overhead of a workspace.

2. **Expo managed workflow, TypeScript template.** `npx create-expo-app@latest -t expo-template-blank-typescript`. Managed lets us avoid Xcode project maintenance; we haven't identified any native module need that forces a bare workflow.

3. **Supabase CLI for local dev, no hosted project yet.** A hosted Supabase project is created in `setup-production-deployment`. Until then, all development is local.

4. **Makefile over npm scripts for the orchestration layer.** Makefile is idiomatic for cross-tool orchestration (Docker + npm + supabase CLI). Individual Makefile targets delegate to npm scripts where it makes sense.

5. **Jest, not Vitest.** React Native ecosystem is Jest-first; `jest-expo` preset works out of the box. Vitest would require custom RN transform config. Jest also works for Edge Function tests via `deno_test`-compatible shims or direct Deno invocation — we'll use Deno's built-in test runner for Edge Functions (decided in `add-google-calendar-sync`), not Jest, but unified under `make test`.

6. **Commit linting with `commitlint` + `husky` from day one.** Low overhead, prevents merge pollution later. Pre-commit hook runs `lint-staged` (Prettier + ESLint on staged files).

7. **`.env.example` is exhaustive, not minimal.** Every future variable is listed with `#` comments explaining which change introduces it. Makes onboarding explicit and prevents the "oh, I needed that var too" churn.

## Risks / Trade-offs

- **Risk:** Expo SDK versions move fast; pinning SDK 52 now might leave us on an outdated SDK by the time we ship. **Mitigation:** `setup-production-deployment` includes a pre-release SDK bump task.
- **Trade-off:** Not setting up CI yet means `main` could in theory go red on a contributor's branch without being caught. Acceptable because this is a solo project for v1.
- **Trade-off:** Single-package repo means sharing types between mobile and Edge Functions requires either duplication or codegen. We'll use `supabase gen types typescript` to generate both consumers' types from the same schema — addressed in `add-person-data-model`.

## Migration Plan

Not applicable — greenfield.

## Open Questions

None blocking. Open questions tracked at `openspec/changes/_open-questions.md` do not block this change.
