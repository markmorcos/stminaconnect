/**
 * IconButton — Pressable with an icon. Hit target is always ≥ 44 × 44dp
 * via padding + hitSlop, regardless of the icon's visual size.
 *
 * a11y: `accessibilityRole="button"`, `accessibilityLabel` is required
 * (icons alone are unintelligible to screen readers).
 */
import { Pressable, type PressableProps, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '../Icon';
import { useTokens } from '../ThemeProvider';

export interface IconButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  name: IconName;
  size?: number;
  color?: string;
  accessibilityLabel: string;
  style?: ViewStyle;
}

export function IconButton({
  name,
  size = 24,
  color,
  accessibilityLabel,
  onPress,
  style,
  disabled,
  ...rest
}: IconButtonProps) {
  const { colors, radii } = useTokens();
  const iconColor = color ?? colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      disabled={disabled}
      onPress={onPress}
      {...rest}
      style={({ pressed }) => [
        {
          width: 44,
          height: 44,
          borderRadius: radii.full,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
        },
        style,
      ]}
    >
      <Icon name={name} size={size} color={iconColor} />
    </Pressable>
  );
}
