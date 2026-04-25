/**
 * Button primitive — token-driven Material Pressable.
 *
 * Variants: `primary` (filled brand), `secondary` (filled secondary),
 * `ghost` (transparent + brand text), `destructive` (filled error).
 * Sizes: `sm` (32 height), `md` (44), `lg` (52). `md` and `lg` meet
 * the 44pt min hit target without hitSlop; `sm` extends via hitSlop.
 *
 * a11y: forwards `accessibilityLabel`. Loading state sets `aria-busy`
 * via Paper's wiring on the underlying Pressable.
 */
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  type ViewStyle,
} from 'react-native';

import { useTokens } from '../ThemeProvider';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  children: string;
  style?: ViewStyle;
}

const HEIGHT: Record<ButtonSize, number> = { sm: 32, md: 44, lg: 52 };

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  children,
  style,
  onPress,
  ...rest
}: ButtonProps) {
  const { colors, radii, spacing: sp } = useTokens();

  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'secondary'
        ? colors.secondary
        : variant === 'destructive'
          ? colors.error
          : 'transparent';
  const fg =
    variant === 'ghost'
      ? colors.primary
      : variant === 'secondary'
        ? colors.text
        : colors.textInverse;
  const borderColor = variant === 'ghost' ? colors.primary : 'transparent';

  const containerStyle: ViewStyle = {
    height: HEIGHT[size],
    paddingHorizontal: size === 'sm' ? sp.md : sp.lg,
    borderRadius: radii.md,
    backgroundColor: bg,
    borderWidth: variant === 'ghost' ? 1 : 0,
    borderColor,
    opacity: disabled || loading ? 0.5 : 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      hitSlop={size === 'sm' ? { top: 6, bottom: 6, left: 6, right: 6 } : undefined}
      disabled={disabled || loading}
      onPress={onPress}
      {...rest}
      style={({ pressed }) => [containerStyle, pressed ? { opacity: 0.8 } : null, style]}
    >
      {loading ? <ActivityIndicator color={fg} size="small" style={styles.spinner} /> : null}
      <Text variant={size === 'sm' ? 'bodySm' : 'bodyLg'} color={fg} style={{ fontWeight: '600' }}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  spinner: { marginEnd: 8 },
});

// Re-export so tests can rely on a consistent shape.
export const __BUTTON_HEIGHTS = HEIGHT;
