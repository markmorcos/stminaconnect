/**
 * Haptics — thin wrapper around `expo-haptics` that honours the user's
 * in-app toggle (`Settings → Accessibility → Haptics`, default on).
 *
 * Five intent-named entry points map to the spec's documented usage:
 *
 *   - `haptics.light()`    — subtle confirmation of a toggle / tap
 *                            (roster row, banner appearance).
 *   - `haptics.medium()`   — completion of a routine action (logging
 *                            a follow-up).
 *   - `haptics.success()`  — happy-path completion (Quick Add saved,
 *                            attendance saved).
 *   - `haptics.warning()`  — confirm-step gate on a destructive
 *                            action.
 *   - `haptics.error()`    — surface that a request failed (4xx, sync
 *                            error).
 *
 * iOS exposes a richer haptic engine than Android; expo-haptics maps
 * down sensibly. The helpers are deliberately fire-and-forget — every
 * call returns `void` and swallows the underlying promise so the call
 * site never has to `await` for tactile feedback.
 */
import * as Haptics from 'expo-haptics';

import { useAccessibilityStore } from '@/state/accessibilityStore';

function enabled(): boolean {
  return useAccessibilityStore.getState().hapticsEnabled;
}

function fire(promise: Promise<void>): void {
  promise.catch(() => {
    // Some Android devices can throw "haptics not supported" — the
    // visible UI feedback is sufficient on its own; silence the
    // rejection so it doesn't surface as an unhandled-promise warning.
  });
}

export const haptics = {
  light(): void {
    if (!enabled()) return;
    fire(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },
  medium(): void {
    if (!enabled()) return;
    fire(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  },
  success(): void {
    if (!enabled()) return;
    fire(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },
  warning(): void {
    if (!enabled()) return;
    fire(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  },
  error(): void {
    if (!enabled()) return;
    fire(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  },
};
