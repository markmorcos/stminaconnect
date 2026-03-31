import { useState, useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../theme/colors';
import { fontFamily, fontSize } from '../theme/typography';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';

interface SearchBarProps extends Omit<TextInputProps, 'onChangeText'> {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder,
  debounceMs = 200,
  ...rest
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (text: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onChangeText(text);
      }, debounceMs);
    },
    [onChangeText, debounceMs]
  );

  return (
    <View style={[styles.container, isFocused && styles.containerFocused]}>
      <Ionicons
        name="search"
        size={18}
        color={isFocused ? colors.primary : colors.inkTertiary}
        style={styles.searchIcon}
      />
      <TextInput
        style={styles.input}
        defaultValue={value}
        onChangeText={handleChange}
        placeholder={placeholder}
        placeholderTextColor={colors.inkTertiary}
        returnKeyType="search"
        clearButtonMode="never"
        autoCorrect={false}
        autoCapitalize="none"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        {...rest}
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => {
            if (timerRef.current) clearTimeout(timerRef.current);
            onChangeText('');
          }}
          style={styles.clearButton}
          hitSlop={8}
          accessibilityLabel="Clear search"
        >
          <Ionicons name="close-circle" size={18} color={colors.inkTertiary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    height: 44,
    paddingHorizontal: spacing[3],
  },
  containerFocused: {
    borderColor: colors.primary,
  },
  searchIcon: {
    marginRight: spacing[2],
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.ink,
    height: '100%',
  },
  clearButton: {
    marginLeft: spacing[2],
  },
});
