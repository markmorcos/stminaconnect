## Context

This is the "make it feel finished" pass before the dev-build switch. Polish work tends to grow without bound; we constrain it with explicit categories and a checklist-style tasks list. SecureStore migration is the only architecturally interesting bit — everything else is hygiene.

## Goals

- Every screen behaves predictably under loading, error, empty, and offline conditions.
- Accessibility meets WCAG AA contrast and minimum tap-target size on every interactive element.
- App performance feels snappy on a mid-range Android phone (not just iPhone).
- Auth tokens move to SecureStore.
- Edge cases around timezones, soft-delete, reassignments are no longer surprising.

## Non-Goals

- New features. This is polish.
- A11y certification beyond WCAG AA.
- Analytics. v1 has none.
- A whole design-system overhaul. We use Paper as-is.

## Decisions

1. **Shared state components**: `ErrorState`, `EmptyState`, `LoadingState` — props-driven, accept a translation key for title/body and an optional action button. Replace bespoke implementations across the app.
2. **Skeleton loaders**: lightweight, Paper-based. We do NOT use `react-native-skeleton-placeholder` (small risk of native quirks); instead, a custom `Skeleton` component using Paper Surface + animated opacity.
3. **Accessibility audit**: maintain a checklist file `docs/a11y-audit.md` with per-screen pass/fail. Failures fixed in this change; passes verified manually with VoiceOver and TalkBack.
4. **Performance**:
   - FlatLists set `getItemLayout` where possible (fixed row height).
   - Heavy computations (streak rendering, dashboard transformations) wrapped in `useMemo`.
   - Avoid inline style objects — extract to `StyleSheet`.
5. **Timezone edge cases**: every date display uses a centralized `formatDate(date, lang, opts)` that takes Europe/Berlin as the church timezone for "today/yesterday" relative formatting, but renders absolute dates in the device's local timezone. Tests around DST boundaries (last Sunday of October / March).
6. **Soft-deleted persons in attendance**: `get_event_attendance` joins on persons; if a person is soft-deleted, the row still appears (because the FK is preserved) but the rendered name is "Removed Member" (already enforced server-side via PII scrub).
7. **Reassigned-mid-event handling**: `marked_by` is the servant who actually marked the attendance. If a person is reassigned afterwards, the previous `marked_by` is preserved. Comment-visibility flip is enforced as a binding rule: the moment `assigned_servant` changes, the prior assigned servant loses comment access and the new assigned servant gains it (no grace period; `assignment_history` records the transition for audit). This rule is set in `add-person-data-model` via the `get_person` RPC and re-asserted in `add-full-registration`'s reassignment flow; this phase verifies the polished UX (no stale-cached comment text after a live reassignment).
8. **SecureStore migration** (one-way):
   - On boot, if `SecureStore.getItemAsync('supabase.auth.token')` is null AND `AsyncStorage.getItem('supabase.auth.token')` is non-null, copy to SecureStore and remove from AsyncStorage.
   - Update Supabase client config to use a SecureStore-backed adapter.
   - Idempotent — second boot skips because SecureStore already has the value.
9. **Sync Issues screen**: lists `local_sync_queue` rows with `needs_attention` flag. Per row: op type, target id, last error, "Discard" button (removes from queue). No retry button — most 4xx errors are not retryable.
10. **Logger**: thin wrapper around `console`. Levels: debug, info, warn, error. In `__DEV__`, all levels print. In prod build (post-phase 16), only warn+ print AND error logs `INSERT` into `logs` table for admin viewing. `logs` retention via `pg_cron`: rows >7 days deleted nightly.
11. **About screen**: read-only. Useful when someone reports an issue — they can read off the app version, sync state, etc.
12. **i18n audit**: a manual review for AR and DE quality. We add a `docs/i18n-review.md` checklist tied to specific keys. Not a CI check — quality is human-judged.

## Risks / Trade-offs

- **Risk**: SecureStore is slower than AsyncStorage; could affect cold-start time. Mitigation: one read on boot, cached in-memory afterwards.
- **Risk**: skeleton loaders increase rendering complexity. We minimize by reusing one component.
- **Trade-off**: not adopting analytics. We could add in v2; tracking pastoral data carries privacy implications worth thinking about deliberately.

## Migration Plan

- Server: one migration for `logs` + cleanup cron.
- Client: SecureStore migration runs on first boot post-deploy; no rollback needed (migration is one-way and forward-compatible).

## Open Questions

- None blocking.
