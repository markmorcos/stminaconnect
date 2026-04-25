/**
 * Spinner — token-colored ActivityIndicator. Default size is `md` (24).
 *
 * a11y: forwards `accessibilityLabel`. Default label is "Loading" so
 * screen readers announce the spinner's purpose.
 */
import { ActivityIndicator, type ActivityIndicatorProps } from 'react-native';

import { useTokens } from '../ThemeProvider';

export interface SpinnerProps extends Omit<ActivityIndicatorProps, 'size' | 'color'> {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

const SIZE_MAP: Record<NonNullable<SpinnerProps['size']>, number> = {
  sm: 16,
  md: 24,
  lg: 36,
};

export function Spinner({
  size = 'md',
  color,
  accessibilityLabel = 'Loading',
  ...rest
}: SpinnerProps) {
  const { colors } = useTokens();
  return (
    <ActivityIndicator
      size={SIZE_MAP[size]}
      color={color ?? colors.primary}
      accessibilityLabel={accessibilityLabel}
      {...rest}
    />
  );
}
