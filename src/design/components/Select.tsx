/**
 * Select / Picker — Paper Menu wrapped with token-aware styling.
 *
 * Variant: single-select dropdown. Multi-select is out of scope for v1.
 *
 * a11y: the trigger button has `accessibilityRole="button"` with the
 * current value as `accessibilityLabel`. Each menu item is selectable
 * via screen reader.
 */
import { useState } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { Menu } from 'react-native-paper';

import { useTokens } from '../ThemeProvider';
import { Icon } from '../Icon';
import { Text } from './Text';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

export interface SelectProps<T extends string = string> {
  value: T | undefined;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function Select<T extends string = string>({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  disabled = false,
  style,
  accessibilityLabel,
}: SelectProps<T>) {
  const { colors, radii, spacing } = useTokens();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <Menu
      visible={open}
      onDismiss={() => setOpen(false)}
      anchor={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? current?.label ?? placeholder}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={() => setOpen(true)}
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              opacity: disabled ? 0.5 : 1,
              minHeight: 44,
            },
            style,
          ]}
        >
          <Text color={current ? colors.text : colors.textMuted}>
            {current?.label ?? placeholder}
          </Text>
          <View style={{ marginStart: spacing.sm }}>
            <Icon name="chevronDown" size={20} color={colors.textMuted} />
          </View>
        </Pressable>
      }
    >
      {options.map((opt) => (
        <Menu.Item
          key={opt.value}
          title={opt.label}
          onPress={() => {
            onChange(opt.value);
            setOpen(false);
          }}
        />
      ))}
    </Menu>
  );
}
