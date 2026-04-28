/**
 * LoadingSkeleton — placeholder bar with a shimmer animation while the
 * surface above it is fetching.
 *
 * Uses `react-native-reanimated` for a 60fps opacity loop. Honours the
 * OS reduce-motion setting via `AccessibilityInfo`: when reduce-motion
 * is on (or after the user toggles it during a session) the shimmer
 * collapses to a static low-opacity bar — the affordance is preserved
 * but motion is suppressed.
 *
 * a11y: marked `accessibilityElementsHidden` so screen readers ignore
 * the placeholder; pair with a parent `accessibilityState.busy` flag.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTokens } from '../ThemeProvider';

export interface LoadingSkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: 'sm' | 'md' | 'lg' | 'full';
  style?: ViewStyle;
}

const SHIMMER_DURATION_MS = 1100;
const SHIMMER_LOW = 0.35;
const SHIMMER_HIGH = 0.75;
const STATIC_OPACITY = 0.5;

export function LoadingSkeleton({
  width = '100%',
  height = 12,
  radius = 'sm',
  style,
}: LoadingSkeletonProps) {
  const { colors, radii } = useTokens();
  const [reduceMotion, setReduceMotion] = useState(false);
  const opacity = useSharedValue(STATIC_OPACITY);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      if (mounted) setReduceMotion(value);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(opacity);
      opacity.value = STATIC_OPACITY;
      return;
    }
    opacity.value = SHIMMER_LOW;
    opacity.value = withRepeat(
      withTiming(SHIMMER_HIGH, { duration: SHIMMER_DURATION_MS }),
      -1,
      true,
    );
    return () => cancelAnimation(opacity);
  }, [opacity, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          backgroundColor: colors.border,
          borderRadius: radii[radius],
        },
        animatedStyle,
        style,
      ]}
    />
  );
}
