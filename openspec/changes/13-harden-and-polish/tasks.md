## 1. Observability

- [ ] 1.1 Install `sentry-expo`; initialize in `services/logger.ts`; gate by env var `EXPO_PUBLIC_SENTRY_DSN`
- [ ] 1.2 Install `@sentry/deno` in each Edge Function; wrap handler with Sentry
- [ ] 1.3 Configure PII scrubbing: allowlist of safe keys; drop others
- [ ] 1.4 Manual: force a crash in dev build with `EXPO_PUBLIC_SENTRY_DSN` set; verify issue lands in Sentry with no PII
- [ ] 1.5 Document Sentry setup in README

## 2. Error handling

- [ ] 2.1 Add `ErrorBoundary` component; wrap each top-level screen in `app/_layout.tsx` and `(tabs)/_layout.tsx`
- [ ] 2.2 Typed error envelope: refactor `services/api/*` wrappers to return `{ ok, ... }`; update callers
- [ ] 2.3 Central `error-messages.ts` mapping `ErrorCode → i18n key`
- [ ] 2.4 Remove any `console.log` / raw errors shown to users
- [ ] 2.5 Tests for ErrorBoundary fallback; snapshot of error UI

## 3. Empty + loading

- [ ] 3.1 Add `components/ui/empty-state.tsx` (icon + title + optional action)
- [ ] 3.2 Add `components/ui/skeleton.tsx` (animated block)
- [ ] 3.3 Audit every list/screen; replace spinners with skeletons where the screen shape is stable; add empty states where missing
- [ ] 3.4 Snapshot tests for each

## 4. Accessibility

- [ ] 4.1 Tap-target audit: add sizing or `hitSlop` to anything < 44pt
- [ ] 4.2 Every Pressable/Button has `accessibilityLabel`
- [ ] 4.3 Streak-health dot gets a parallel text ("At risk", "Imminent", "Healthy") visible to screen readers
- [ ] 4.4 Color contrast: run contrast checker on all text/bg combos; fix failures
- [ ] 4.5 Dynamic type: remove fixed font sizes on body text
- [ ] 4.6 Manual: use iOS VoiceOver on each major screen; confirm it narrates sensibly

## 5. Performance

- [ ] 5.1 Measure baseline cold-start via Flipper/Hermes profiling
- [ ] 5.2 Lazy-load Victory Native only when admin dashboard mounts
- [ ] 5.3 Memoize heavy list rows (`React.memo` + stable key)
- [ ] 5.4 Ensure SQLite migrations run async off the critical path; show a one-time "Preparing…" splash if first launch
- [ ] 5.5 Target cold-start < 2s on Moto G Power (or equivalent); document measurements

## 6. GDPR hard delete

- [ ] 6.1 Migration `026_admin_hard_delete_audit.sql`: `admin_deletion_audit` table; `hard_delete_person(id, reason)` RPC (admin only) with CASCADE
- [ ] 6.2 Admin Person detail overflow: "Delete permanently" — requires typing the person's name to confirm + reason field
- [ ] 6.3 After delete, shows confirmation + navigates back; audit row persisted
- [ ] 6.4 Tests: non-admin cannot call; audit inserted on success; cascades actually delete attendance, comments, alerts, follow-ups

## 7. Deactivated-user polish

- [ ] 7.1 Update the "Account deactivated" screen to show church contact info + "Request reactivation" button (mailto link)
- [ ] 7.2 Localize all strings

## 8. Settings additions

- [ ] 8.1 Add Help / Contact section with phone + email (seeded via `config.ts` / env or a `app_config` table)
- [ ] 8.2 Add "Export my device data" action (JSON dump) for debugging — no PII leaves the device

## 9. Tablet-responsive sanity

- [ ] 9.1 Verify on iPad + large Android tablet that layouts render without broken overflow
- [ ] 9.2 Cap max content width on very wide screens

## 10. OS version floor

- [ ] 10.1 Runtime check at boot; if iOS < 15 or Android API < 29, render a "Please update" screen
- [ ] 10.2 Set Expo `minimumOS` configs accordingly in `app.config.ts`

## 11. Verification

- [ ] 11.1 Manual: smoke test every feature in all three languages
- [ ] 11.2 Manual: force a Sentry-reported error; confirm it appears
- [ ] 11.3 Manual: admin hard-deletes a test member; verify all related rows are gone; audit row present
- [ ] 11.4 Manual: accessibility pass with VoiceOver
- [ ] 11.5 `make test`, `make lint`, `make typecheck` pass
- [ ] 11.6 `openspec validate harden-and-polish` passes
- [ ] 11.7 Every scenario in new and modified spec files
