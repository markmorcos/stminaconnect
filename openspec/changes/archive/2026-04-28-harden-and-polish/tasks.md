# Tasks — harden-and-polish

## 1. State components polish

- [x] 1.1 The `ErrorState`, `EmptyState`, `LoadingSkeleton` components already exist in design-system. Wire them everywhere a list or async surface lacks a state.
- [x] 1.2 Add localized illustrations: each `EmptyState` consumer accepts an `iconName` (lucide); curate the per-list icon mapping (e.g., persons list → `users`, follow-ups → `mail`, today's events → `calendar`).
- [x] 1.3 Verify EVERY list screen (Persons, Today's events, Roster, Notifications inbox, Pending follow-ups, Servant home My Group, Admin dashboard sections) handles loading, empty, and error states with the design-system primitives.

## 2. Animated skeletons

- [x] 2.1 Install `react-native-reanimated` (verify Expo Go SDK ≥ 50).
- [x] 2.2 Upgrade `LoadingSkeleton` in `src/design/components/LoadingSkeleton.tsx`: shimmer animation honoring `AccessibilityInfo.isReduceMotionEnabled()` (falls back to static).
- [x] 2.3 Persons list, Today's events, Roster, Notifications inbox, Pending follow-ups, Servant home, Admin dashboard sections all show the animated skeleton during loads.

## 2b. Motion polish

- [x] 2b.1 Screen transitions: configure Expo Router stack with `slide_from_right` for push and `modal` (slide up + fade) for modal routes; tune durations to design-system motion tokens.
- [x] 2b.2 `Button` press micro-interaction: scale 0.97 + opacity 0.9 on press, returning on release. Reduce-motion respects.
- [x] 2b.3 Sync status indicator pulse while `state === 'pulling' | 'pushing'` (subtle scale + opacity loop). Reduce-motion respects.
- [x] 2b.4 Notification banner slide-in from top + slide-out on dismiss (250ms `motion.durationBase`).
- [x] 2b.5 Roster row check toggle: scale bounce on tap (0.95 → 1.05 → 1.0).
- [x] 2b.6 Welcome-back banner subtle shimmer (matches "joyful" feedback intent).

## 2c. Haptic feedback

- [x] 2c.1 Install `expo-haptics`.
- [x] 2c.2 `src/utils/haptics.ts`: thin wrapper exposing `light()`, `medium()`, `success()`, `warning()`, `error()` — each respects an in-app toggle (Settings → Accessibility → Haptics, default on).
- [x] 2c.3 Wire haptics:
  - Roster row toggle → `light()`.
  - Quick Add submit success → `success()`.
  - Follow-up complete → `medium()`.
  - Notification banner appear → `light()` (selection-style).
  - Destructive confirmation enabled (typed name matches) → `warning()`.
  - Sync error / 4xx → `error()`.
- [x] 2c.4 Add `app/(app)/settings/accessibility.tsx` exposing the haptics toggle (and reduce-motion override stub).

## 3. Accessibility

- [x] 3.1 Audit every Pressable/IconButton/Chip — set `accessibilityLabel`, `accessibilityRole`, `accessibilityState` (e.g. `selected`, `disabled`).
- [x] 3.2 Audit tap target sizes — bump under-spec'd ones to 44pt iOS / 48pt Android. (Design-system primitives already enforce this; check feature-level custom usages.)
- [x] 3.3 Re-run the contrast suite from `add-brand-assets` against any newly-introduced color pairings; fix violations in tokens.
- [x] 3.4 Manual pass with VoiceOver (iOS) and TalkBack (Android) on every primary screen; fix focus order and missing announcements.
- [x] 3.5 Dynamic type: render `Text` at `PixelRatio.getFontScale() = 1.5` and `2.0`; fix wrapping/truncation issues.
- [x] 3.6 Reduce-motion: set OS reduce-motion on; confirm animations fall back to instant transitions; document in `docs/a11y-audit.md`.
- [x] 3.7 Increase-contrast / Bold-text: verify rendering remains correct; document.
- [x] 3.8 RTL focus order verified on Arabic locale.
- [x] 3.9 Document results in `docs/a11y-audit.md` per-screen, with pass/fail and remediation notes.

## 4. Performance

- [x] 4.1 Add `getItemLayout` and `keyExtractor` to all FlatLists.
- [x] 4.2 `useMemo` / `useCallback` audit on dashboard pages and roster.
- [x] 4.3 Move inline styles to `StyleSheet`.
- [x] 4.4 Profile a cold start and a roster of 200 people on a mid-range Android.

## 5. Timezone correctness

- [x] 5.1 `src/utils/formatDate.ts` with Europe/Berlin "today/yesterday" logic; absolute dates in device tz.
- [x] 5.2 Unit tests around DST transitions (last Sunday of October 2026, last Sunday of March 2027).

## 6. Soft-deleted edge cases

- [x] 6.1 `get_event_attendance` projection includes a `deleted` boolean for the person; UI shows "Removed Member" when true.
- [x] 6.2 Sync queue handling: if the engine encounters a 4xx referencing a soft-deleted person, surface a clear notification.

## 7. SecureStore migration

- [x] 7.1 Install `expo-secure-store`.
- [x] 7.2 Adapter `src/services/storage/secureAuthStorage.ts` matching Supabase JS storage adapter shape.
- [x] 7.3 Boot-time migration in `app/_layout.tsx`: if AsyncStorage has session and SecureStore doesn't, copy and clear.
- [x] 7.4 Configure Supabase client to use SecureStore adapter.

## 8. Sync Issues screen

- [x] 8.1 `app/(app)/sync-issues.tsx`: lists `needs_attention` queue items with op type, target person/event display name, last_error, created_at.
- [x] 8.2 Per-row "Discard" button removes from queue.
- [x] 8.3 Link to this screen from the sync status panel.

## 9. Logger

- [x] 9.1 `src/utils/logger.ts`: levels debug/info/warn/error. `__DEV__` prints all; prod build logs error to `logs` table.
- [x] 9.2 Migration `030_logs.sql` + nightly retention cron.
- [x] 9.3 Refactor `console.log/warn/error` calls to use logger.

## 10. About / Diagnostics screen

- [x] 10.1 `app/(app)/about.tsx`: app version (from `Constants.expoConfig.version`), sync state, last sync, needs-attention count, env, language, build SHA if available.

## 11. i18n audit

- [x] 11.1 Walk every key with a native AR speaker; record results in `docs/i18n-review.md`.
- [x] 11.2 Same for DE.
- [x] 11.3 Verify no `[MISSING]` warnings appear in dev console during a full app walk-through.

## 12. Tests

- [x] 12.1 Component: ErrorState, EmptyState, LoadingState, Skeleton render correctly.
- [x] 12.2 Unit: formatDate edge cases.
- [x] 12.3 Unit: SecureStore migration is idempotent.
- [x] 12.4 Integration: 4xx referring to soft-deleted person produces structured notification.
- [x] 12.5 Snapshot regression test of dashboards in DE locale.

## 13. Verification (in Expo Go)

- [x] 13.1 Walk every screen — every loading, error, empty state shows correctly with animated skeleton, illustrated empty, and themed error.
- [x] 13.2 Run with VoiceOver on; navigation order, labels, roles all correct.
- [x] 13.3 Tokens have moved to SecureStore (verify via debug screen showing token source).
- [x] 13.4 Trigger a 4xx scenario — Sync Issues screen shows the entry; "Discard" removes it.
- [x] 13.5 No `[MISSING]` translation warnings in console during a full session.
- [x] 13.6 Animation polish visible: button press scale, screen transitions, sync indicator pulse, banner slide.
- [x] 13.7 Haptic feedback fires on the documented actions; toggling Settings → Accessibility → Haptics off silences them.
- [x] 13.8 Enable OS reduce-motion → animations fall back to instant.
- [x] 13.9 Set device font scale to 200% → no truncation/clipping in critical flows.
- [x] 13.10 Switch device to dark mode → entire UI adapts; contrast suite still green.
- [x] 13.11 `make test` clean, coverage ≥ 80% on services/features.
- [x] 13.12 `openspec validate harden-and-polish` passes.
