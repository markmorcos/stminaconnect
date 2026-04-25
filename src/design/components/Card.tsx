/**
 * Card — token-aware Surface. Defaults to `elevation.sm` and `radii.lg`.
 *
 * a11y: forwards `accessibilityLabel`. Set `accessibilityRole="summary"`
 * for read-only content cards or `"button"` for tappable ones.
 */
import { type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

import { useTokens } from '../ThemeProvider';
import type { ElevationKey } from '../tokens';

export interface CardProps {
  children: ReactNode;
  elevation?: ElevationKey;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  style?: ViewStyle;
  accessibilityLabel?: string;
}

const PADDING_MAP: Record<
  NonNullable<CardProps['padding']>,
  keyof ReturnType<typeof useTokens>['spacing']
> = {
  none: '0',
  sm: 'sm',
  md: 'md',
  lg: 'lg',
};

export function Card({
  children,
  elevation = 'sm',
  padding = 'md',
  style,
  accessibilityLabel,
}: CardProps) {
  const { colors, radii, elevation: elev, spacing } = useTokens();
  const e = elev[elevation];
  const padToken = PADDING_MAP[padding];
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radii.lg,
          padding: spacing[padToken],
          shadowColor: e.shadowColor,
          shadowOpacity: e.shadowOpacity,
          shadowRadius: e.shadowRadius,
          shadowOffset: e.shadowOffset,
          elevation: e.elevation,
          borderWidth: elevation === 'none' ? 1 : 0,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
