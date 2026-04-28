/**
 * haptics — five intent-named helpers, each a no-op when the user has
 * disabled `hapticsEnabled` via Settings → Accessibility → Haptics.
 *
 * Verifies:
 *   - Default-on dispatches the matching expo-haptics call.
 *   - Toggling off short-circuits before any expo-haptics call.
 *   - The mapping (light → impact Light, success → notification Success,
 *     etc.) matches the spec.
 */
import * as Haptics from 'expo-haptics';

import { haptics } from '@/utils/haptics';
import {
  __resetAccessibilityStoreForTests,
  useAccessibilityStore,
} from '@/state/accessibilityStore';

const impactMock = Haptics.impactAsync as jest.Mock;
const notificationMock = Haptics.notificationAsync as jest.Mock;

beforeEach(() => {
  __resetAccessibilityStoreForTests();
  impactMock.mockClear();
  notificationMock.mockClear();
});

describe('haptics', () => {
  it('default-on dispatches the matching expo-haptics call', () => {
    haptics.light();
    haptics.medium();
    haptics.success();
    haptics.warning();
    haptics.error();

    expect(impactMock).toHaveBeenCalledTimes(2);
    expect(impactMock).toHaveBeenNthCalledWith(1, Haptics.ImpactFeedbackStyle.Light);
    expect(impactMock).toHaveBeenNthCalledWith(2, Haptics.ImpactFeedbackStyle.Medium);

    expect(notificationMock).toHaveBeenCalledTimes(3);
    expect(notificationMock).toHaveBeenNthCalledWith(1, Haptics.NotificationFeedbackType.Success);
    expect(notificationMock).toHaveBeenNthCalledWith(2, Haptics.NotificationFeedbackType.Warning);
    expect(notificationMock).toHaveBeenNthCalledWith(3, Haptics.NotificationFeedbackType.Error);
  });

  it('skips dispatch when the user has disabled haptics', () => {
    useAccessibilityStore.getState().setHapticsEnabled(false);

    haptics.light();
    haptics.medium();
    haptics.success();
    haptics.warning();
    haptics.error();

    expect(impactMock).not.toHaveBeenCalled();
    expect(notificationMock).not.toHaveBeenCalled();
  });

  it('swallows expo-haptics rejections so unsupported devices stay silent', async () => {
    impactMock.mockRejectedValueOnce(new Error('haptics not supported'));
    expect(() => haptics.light()).not.toThrow();
    // Wait a microtask so the rejection has a chance to propagate.
    await new Promise((resolve) => setImmediate(resolve));
  });
});
