## Context

This is the bootstrap change. The repo currently contains only the OpenSpec folder. Every architectural decision committed here propagates everywhere; revisiting in later phases is expensive. Constraints: solo developer, part-time work, Expo Go-first, EU-region Supabase, free-tier infrastructure.

## Goals

- A repo that runs in Expo Go in under 60 seconds for a fresh developer (`git clone` → `make install` → `make dev-up` → `npx expo start`).
- Pinned versions; reproducible builds.
- Test infrastructure ready before any business logic exists.
- A `Makefile` that becomes the canonical command surface — no one should need to remember the underlying CLIs.

## Non-Goals

- No Auth in this phase — a placeholder screen is enough to prove the toolchain.
- No i18n yet — that's `add-i18n-foundation` (phase 3).
- No real database schema beyond Supabase's defaults — phase 4 introduces `persons`/`servants`.
- No CI/CD yet — local checks only.
- **No real push notifications** — full stop until phase 17.
- No EAS configuration — phase 16.

## Decisions

1. **Use Expo managed workflow, not bare**. Expo Go-first requires it. EAS Build will be opt-in later in phase 16 via `expo-dev-client`.
2. **Pin Expo SDK to the latest stable at session time** in `package.json` and in `app.json`'s `runtimeVersion: { policy: "sdkVersion" }`. Floating versions cause silent breakage between dev sessions.
3. **`supabase/` folder lives at repo root, not under `src/`**. It's a logically separate stack (server) from the mobile client.
4. **Single repo, not monorepo**. <200 members, <15 servants — a monorepo's overhead is not justified.
5. **Use Yarn or npm? → npm**. Default. Simpler for a solo dev. Pinned via `engines` field in `package.json`.
6. **Husky pre-commit hook**: runs `npm run lint` and `npm run typecheck`. Tests run in `make test` and on archive — not on every commit (slows iteration).
7. **`Makefile` over npm scripts** for orchestration. npm scripts call into Make where they delegate to multi-step ops (`make dev-up` runs `supabase start && npx expo start`). Reasoning: Make handles "compound + idempotent" command chains better than `&&`-chained npm scripts; also gives a uniform language across mobile + Supabase + Edge Functions later.
8. **Smoke test**: Jest test that imports `services/api/supabase.ts`, asserts the client constructs without throwing. Validates env-var wiring and Supabase JS install.
9. **No global state library invoked yet** — Zustand and TanStack Query are installed but not initialized in this phase. Phase 2 (auth) is the first to use them.
10. **`.env.example` is exhaustive from day 1**, including vars that won't be wired until later phases (Google service account, push, etc.). Marked with `# unused until phase N` comments. Avoids scattering env declarations across phases.

11. **Bundle identifier** locked at scaffolding time: `tech.morcos.stminaconnect` for both iOS (`expo.ios.bundleIdentifier`) and Android (`expo.android.package`). Reverse-DNS uses the developer's domain `morcos.tech`; brandable; future-proof. Locked here because changing it post-store-submission is painful (effectively requires creating a new app record). Re-confirmed in `prepare-store-listings` and consumed in `setup-production-deployment`.

12. **Asset folder layout**: `assets/branding/`, `assets/icons/`, `assets/fonts/`, `assets/images/`. `assets/icons/` holds the placeholder app icon and splash configured here; `add-brand-assets` swaps in the real cross-glyph designs without folder churn. Fonts (`Inter` + `IBM Plex Sans Arabic`) land in `assets/fonts/` via `setup-design-system`.

13. **`expo.userInterfaceStyle = "automatic"`** committed at scaffolding time so dark mode "just works" once `setup-design-system` lands. Setting it later requires an iOS rebuild — cheaper to declare it now even though no theming logic exists yet.

## Risks / Trade-offs

- **Risk**: pinning the Expo SDK at session time means an upgrade story is needed later. Mitigation: documented in README; a future change can bump SDK with full regression of Expo Go-only changes.
- **Risk**: Supabase CLI requires Docker. New machines need Docker installed. Mitigation: `make dev-up` checks for Docker and prints a clear error if missing.
- **Trade-off**: bundling Paper + NativeWind would pull in two systems. We commit to **Paper-only** for now. If layout pain arises later, NativeWind can be added as a second-pass styling layer (RTL primitives still come from Paper).

## Migration Plan

N/A — first change. Rollback is `rm -rf` the repo and start over.

## Open Questions

- None.
