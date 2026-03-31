import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Modal,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../theme/colors';
import { fontFamily, fontSize, lineHeight } from '../theme/typography';
import { radius } from '../theme/radius';
import { spacing, layout } from '../theme/spacing';
import { normalizePhone } from '../utils/phone';

const COUNTRY_CODES = [
  { code: '+49', flag: '🇩🇪', name: 'Germany' },
  { code: '+20', flag: '🇪🇬', name: 'Egypt' },
  { code: '+1', flag: '🇺🇸', name: 'USA / Canada' },
  { code: '+44', flag: '🇬🇧', name: 'United Kingdom' },
  { code: '+43', flag: '🇦🇹', name: 'Austria' },
  { code: '+41', flag: '🇨🇭', name: 'Switzerland' },
];

interface PhoneInputProps {
  label: string;
  value: string;
  onChangeText: (e164: string) => void;
  error?: string;
  disabled?: boolean;
}

export function PhoneInput({
  label,
  value,
  onChangeText,
  error,
  disabled = false,
}: PhoneInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  // Derive selectedCountry and localNumber from the E.164 value
  const selectedCountry =
    COUNTRY_CODES.find((c) => value.startsWith(c.code)) ?? COUNTRY_CODES[0];
  const localNumber = value.startsWith(selectedCountry.code)
    ? value.slice(selectedCountry.code.length)
    : value.startsWith('+')
      ? ''
      : value;

  function handleLocalNumberChange(text: string) {
    // Only allow digits
    const digits = text.replace(/[^\d]/g, '');
    onChangeText(selectedCountry.code + digits);
  }

  function handleCountrySelect(country: (typeof COUNTRY_CODES)[number]) {
    setShowPicker(false);
    // Re-normalize with new country code
    const digits = localNumber.replace(/[^\d]/g, '');
    onChangeText(country.code + digits);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.row,
          isFocused && styles.rowFocused,
          error ? styles.rowError : null,
          disabled && styles.rowDisabled,
        ]}
      >
        <Pressable
          style={styles.countryButton}
          onPress={() => !disabled && setShowPicker(true)}
          accessibilityLabel={`Country code: ${selectedCountry.code}`}
        >
          <Text style={styles.flag}>{selectedCountry.flag}</Text>
          <Text style={styles.countryCode}>{selectedCountry.code}</Text>
          <Ionicons
            name="chevron-down"
            size={14}
            color={colors.inkSecondary}
            style={styles.chevron}
          />
        </Pressable>

        <View style={styles.divider} />

        <TextInput
          style={styles.input}
          value={localNumber}
          onChangeText={handleLocalNumberChange}
          keyboardType="phone-pad"
          placeholder="151 23456789"
          placeholderTextColor={colors.inkTertiary}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            // Normalize on blur
            if (localNumber) {
              const normalized = normalizePhone(
                selectedCountry.code + localNumber
              );
              onChangeText(normalized);
            }
          }}
          editable={!disabled}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal
        visible={showPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPicker(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setShowPicker(false)}
        />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Select Country Code</Text>
          <FlatList
            data={COUNTRY_CODES}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.countryRow,
                  item.code === selectedCountry.code &&
                    styles.countryRowSelected,
                ]}
                onPress={() => handleCountrySelect(item)}
              >
                <Text style={styles.flagLarge}>{item.flag}</Text>
                <Text style={styles.countryName}>{item.name}</Text>
                <Text style={styles.countryCodeLarge}>{item.code}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[4],
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.bodySmall,
    lineHeight: lineHeight.bodySmall,
    color: colors.inkSecondary,
    marginBottom: spacing[2] - 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    height: layout.inputHeight,
    overflow: 'hidden',
  },
  rowFocused: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  rowError: {
    borderColor: colors.absent,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    height: '100%',
  },
  flag: {
    fontSize: 20,
    marginRight: spacing[1],
  },
  countryCode: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.body,
    color: colors.ink,
  },
  chevron: {
    marginLeft: 2,
  },
  divider: {
    width: 1,
    height: '60%',
    backgroundColor: colors.border,
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing[3],
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.ink,
    height: '100%',
  },
  errorText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.bodySmall,
    lineHeight: lineHeight.bodySmall,
    color: colors.absent,
    marginTop: spacing[1],
  },
  // Modal sheet
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing[4],
    paddingBottom: spacing[8],
    maxHeight: '50%',
  },
  sheetTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.h3,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing[3],
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
  },
  countryRowSelected: {
    backgroundColor: colors.sandDark,
  },
  flagLarge: {
    fontSize: 24,
    marginRight: spacing[3],
  },
  countryName: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.ink,
  },
  countryCodeLarge: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.body,
    color: colors.inkSecondary,
  },
});
