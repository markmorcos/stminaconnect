## Why

The earlier phases ship full functionality but accumulate small rough edges: inconsistent error states, missing empty states, accessibility gaps, no SecureStore for tokens, edge cases around timezones / soft-deleted persons / reassignments — and importantly, no motion design or haptics. This change is a comprehensive polish pass before GDPR + dev-build. Skipping it means shipping a v1 that _works_ but feels janky.

## What Changes

- **MODIFIED** every screen with consistent error / loading / empty states using design-system primitives (`ErrorState`, `EmptyState`, `LoadingSkeleton` already shipped in `setup-design-system`; this phase wires them into every list/screen and adds polish).
- **ADDED** Polished empty-state illustrations using `lucide-react-native` icons + brand-colored backdrops; one per major list (persons, today's events, roster, notifications, pending follow-ups). All themed for light + dark.
- **ADDED** Animated `LoadingSkeleton` (replaces the static stand-in from `setup-design-system`): shimmer animation via `react-native-reanimated` (Expo Go compatible from SDK 50). Used on every list screen.
- **ADDED** Motion polish via `react-native-reanimated`:
  - Screen transitions tuned (slide on push, fade on modal).
  - Button press scale + opacity micro-interaction.
  - Sync status indicator pulse animation while syncing.
  - Notification banner slide-in/out.
  - Roster row check toggle bounce.
- **ADDED** Haptic feedback via `expo-haptics`:
  - Light impact on toggling a roster row.
  - Light impact on Quick Add submit success.
  - Medium impact on follow-up complete.
  - Notification on banner appear (selection feedback).
  - Warning haptic on destructive action confirmation.
- **ADDED** Accessibility pass:
  - All interactive elements have `accessibilityLabel`, `accessibilityRole`, and `accessibilityState`.
  - Tap targets ≥ 44pt (iOS) / 48pt (Android) verified across every interactive component.
  - Color contrast checked against WCAG AA in BOTH light and dark themes (the contrast suite from `add-brand-assets` is extended to cover any newly added pairings).
  - Screen reader navigation order verified on iOS (VoiceOver) and Android (TalkBack) — full per-screen pass documented in `docs/a11y-audit.md`.
  - Dynamic type / system font scaling respected — all `Text` variants scale with `PixelRatio.getFontScale()`.
  - Reduce-motion respected — animations honor `AccessibilityInfo.isReduceMotionEnabled()`; falls back to instant transitions.
  - Reduce-transparency / increase-contrast modes verified via OS settings.
  - RTL focus order verified (Arabic locale).
- **ADDED** Performance pass:
  - FlatList tuning (`getItemLayout`, `keyExtractor`, `removeClippedSubviews`).
  - Memoization of expensive computations and component renders.
  - Image lazy loading where applicable.
- **ADDED** Edge-case handling:
  - Timezone correctness around DST transitions.
  - Soft-deleted persons gracefully handled in attendance retrievals (keep historical rows; mark display as "Removed Member").
  - Reassigned-mid-event handling: the marked_by stays the original servant; ownership for comment visibility flips immediately as already specified in phase 4.
  - Sync queue items referencing soft-deleted persons surface a clear failure (4xx path).
- **ADDED** SecureStore migration for the auth token: tokens move from AsyncStorage → expo-secure-store at app boot. Backward-compatible read from AsyncStorage on first run, then move and clear.
- **ADDED** "Sync Issues" admin/servant screen `app/(app)/sync-issues.tsx` exposing `needs_attention` queue items so users can inspect / discard them (deferred from phase 10).
- **ADDED** Comprehensive logging: a `logger` module with debug/info/warn/error levels; production builds suppress debug+info; error logs go to a structured `logs` table for admin diagnostics (one-week retention).
- **ADDED** "About / Diagnostics" screen showing app version, sync state, last sync, count of needs-attention items, env (local/prod), language. Useful for support.
- **ADDED** Final i18n audit: every key has authentic translations (no `[MISSING]` in dev), AR review by a native speaker (manual checklist), DE review (manual checklist).

## Impact

- **Affected specs**: cross-cutting modifications to `attendance`, `person-management`, `auth`, `offline-sync`, `notifications`, `i18n`, `design-system` — each gets a small additive requirement around polish.
- **Affected code**: many UI surfaces. Animations and haptics added as design-system extensions. Migration `026_logs.sql` for the logs table.
- **Breaking changes**: SecureStore migration is one-way (reads from AsyncStorage once, then writes only to SecureStore). Documented.
- **Migration needs**: one server migration (`030_logs.sql`); one client-side migration runner step.
- **Expo Go compatible**: yes — `expo-secure-store`, `react-native-reanimated` (SDK 50+), and `expo-haptics` all work in Expo Go.
- **Uses design system**: yes — animations, haptics, and state components extend the design-system primitives rather than introducing parallel UI patterns.
- **Dependencies**: all prior phases.
