/**
 * Chip — single- or multi-select tag. `selected` toggles the visual
 * state. Tappable; respects 44pt min hit target via padding + hitSlop.
 *
 * a11y: `accessibilityRole="button"`, `accessibilityState.selected`
 * mirrors the prop.
 */
import { Pressable, type PressableProps, type ViewStyle } from 'react-native';

import { useTokens } from '../ThemeProvider';
import { Text } from './Text';

export interface ChipProps extends Omit<PressableProps, 'children' | 'style'> {
  selected?: boolean;
  children: string;
  style?: ViewStyle;
}

export function Chip({
  selected = false,
  children,
  onPress,
  style,
  accessibilityLabel,
  ...rest
}: ChipProps) {
  const { colors, radii, spacing } = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? children}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      onPress={onPress}
      {...rest}
      style={({ pressed }) => [
        {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs + 2,
          borderRadius: radii.full,
          backgroundColor: selected ? colors.primary : colors.surface,
          borderWidth: 1,
          borderColor: selected ? colors.primary : colors.border,
          opacity: pressed ? 0.8 : 1,
          minHeight: 36,
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text variant="bodySm" color={selected ? colors.textInverse : colors.text} align="center">
        {children}
      </Text>
    </Pressable>
  );
}
