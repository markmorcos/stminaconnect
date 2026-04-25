/**
 * Badge — small status/priority pill.
 *
 * Variants:
 *  - `neutral` (subtle muted tint)
 *  - `success` / `warning` / `error` / `info`
 *  - `priorityHigh` / `priorityMedium` / `priorityLow` / `priorityVeryLow`
 *    (used for streak status colors and priority chips)
 *
 * a11y: forwards `accessibilityLabel`. The label should describe the
 * status (e.g. "Priority: high") for screen readers.
 */
import { View, type ViewStyle } from 'react-native';

import { useTokens } from '../ThemeProvider';
import { Text } from './Text';

export type BadgeVariant =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'priorityHigh'
  | 'priorityMedium'
  | 'priorityLow'
  | 'priorityVeryLow';

export interface BadgeProps {
  variant?: BadgeVariant;
  children: string;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function Badge({ variant = 'neutral', children, style, accessibilityLabel }: BadgeProps) {
  const { colors, radii, spacing } = useTokens();

  const palette: Record<BadgeVariant, { bg: string; fg: string }> = {
    neutral: { bg: colors.border, fg: colors.text },
    success: { bg: colors.success, fg: colors.textInverse },
    warning: { bg: colors.warning, fg: colors.textInverse },
    error: { bg: colors.error, fg: colors.textInverse },
    info: { bg: colors.info, fg: colors.textInverse },
    priorityHigh: { bg: colors.error, fg: colors.textInverse },
    priorityMedium: { bg: colors.warning, fg: colors.textInverse },
    priorityLow: { bg: colors.info, fg: colors.textInverse },
    priorityVeryLow: { bg: colors.border, fg: colors.text },
  };
  const { bg, fg } = palette[variant];

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          alignSelf: 'flex-start',
          paddingHorizontal: spacing.sm,
          paddingVertical: 2,
          borderRadius: radii.full,
          backgroundColor: bg,
        },
        style,
      ]}
    >
      <Text variant="caption" color={fg}>
        {children}
      </Text>
    </View>
  );
}
