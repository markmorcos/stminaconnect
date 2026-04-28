/**
 * Button primitive — token-driven Material Pressable.
 *
 * Variants: `primary` (filled brand), `secondary` (filled secondary),
 * `ghost` (transparent + brand text), `destructive` (filled error).
 * Sizes: `sm` (32 height), `md` (44), `lg` (52). `md` and `lg` meet
 * the 44pt min hit target without hitSlop; `sm` extends via hitSlop.
 *
 * Press micro-interaction: scales to 0.97 with a slight opacity dip
 * (reanimated, 100ms). Honours OS reduce-motion: when on, the press
 * style collapses to opacity-only (matches Pressable's old behaviour).
 *
 * The Animated.View wraps the visible body so the press scale is
 * driven by reanimated without breaking Pressable's `style({pressed})`
 * callback (which doesn't see worklet shared values).
 *
 * a11y: forwards `accessibilityLabel`. Loading state sets `aria-busy`
 * via Paper's wiring on the underlying Pressable.
 */
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme, useTokens } from '../ThemeProvider';
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
const PRESS_DURATION_MS = 100;
const PRESS_SCALE = 0.97;

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
  const { isDark } = useTheme();

  const [reduceMotion, setReduceMotion] = useState(false);
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

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'secondary'
        ? colors.secondary
        : variant === 'destructive'
          ? colors.error
          : 'transparent';
  // Secondary's background is gold in both modes — always pair with the
  // mode's dark ink so contrast holds. In light mode that's `text`; in
  // dark mode the dark ink is exposed via `textInverse`.
  const fg =
    variant === 'ghost'
      ? colors.primary
      : variant === 'secondary'
        ? isDark
          ? colors.textInverse
          : colors.text
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
      onPressIn={() => {
        if (reduceMotion) return;
        scale.value = withTiming(PRESS_SCALE, { duration: PRESS_DURATION_MS });
      }}
      onPressOut={() => {
        if (reduceMotion) return;
        scale.value = withTiming(1, { duration: PRESS_DURATION_MS });
      }}
      onPress={onPress}
      {...rest}
      style={({ pressed }) => [pressed ? { opacity: 0.8 } : null, style]}
    >
      <Animated.View style={[containerStyle, animatedStyle]}>
        {loading ? <ActivityIndicator color={fg} size="small" style={styles.spinner} /> : null}
        <Text
          variant={size === 'sm' ? 'bodySm' : 'bodyLg'}
          color={fg}
          style={{ fontWeight: '600' }}
        >
          {children}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  spinner: { marginEnd: 8 },
});

// Re-export so tests can rely on a consistent shape.
export const __BUTTON_HEIGHTS = HEIGHT;
