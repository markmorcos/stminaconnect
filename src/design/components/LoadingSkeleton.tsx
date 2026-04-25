/**
 * LoadingSkeleton — static placeholder bar in `colors.border`.
 * The shimmer animation lands in the `harden-and-polish` change.
 *
 * a11y: marked `accessibilityElementsHidden` so screen readers ignore
 * the placeholder; pair with a parent `accessibilityState.busy` flag.
 */
import { View, type ViewStyle } from 'react-native';

import { useTokens } from '../ThemeProvider';

export interface LoadingSkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: 'sm' | 'md' | 'lg' | 'full';
  style?: ViewStyle;
}

export function LoadingSkeleton({
  width = '100%',
  height = 12,
  radius = 'sm',
  style,
}: LoadingSkeletonProps) {
  const { colors, radii } = useTokens();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          backgroundColor: colors.border,
          borderRadius: radii[radius],
          opacity: 0.5,
        },
        style,
      ]}
    />
  );
}
