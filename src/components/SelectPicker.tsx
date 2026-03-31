import { useState } from 'react';
import {
  View,
  Text,
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

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectPickerProps {
  label: string;
  value: string | null;
  options: SelectOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  nullable?: boolean;
  nullLabel?: string;
}

export function SelectPicker({
  label,
  value,
  options,
  onValueChange,
  placeholder = 'Select…',
  error,
  disabled = false,
  nullable = false,
  nullLabel = 'None',
}: SelectPickerProps) {
  const [showModal, setShowModal] = useState(false);

  const selectedLabel =
    options.find((o) => o.value === value)?.label ?? null;

  const allOptions: SelectOption[] = nullable
    ? [{ value: '__null__', label: nullLabel }, ...options]
    : options;

  function handleSelect(option: SelectOption) {
    setShowModal(false);
    onValueChange(option.value === '__null__' ? '' : option.value);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={[
          styles.trigger,
          error ? styles.triggerError : null,
          disabled && styles.triggerDisabled,
        ]}
        onPress={() => !disabled && setShowModal(true)}
        accessibilityRole="button"
      >
        <Text
          style={[styles.triggerText, !selectedLabel && styles.placeholderText]}
          numberOfLines={1}
        >
          {selectedLabel ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.inkSecondary} />
      </Pressable>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setShowModal(false)}
        />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{label}</Text>
          <FlatList
            data={allOptions}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.optionRow,
                  item.value === value && styles.optionRowSelected,
                ]}
                onPress={() => handleSelect(item)}
                accessibilityRole="menuitem"
              >
                <Text
                  style={[
                    styles.optionText,
                    item.value === value && styles.optionTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
                {item.value === value && (
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={colors.primary}
                  />
                )}
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
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    height: layout.inputHeight,
    paddingHorizontal: spacing[4],
  },
  triggerError: {
    borderColor: colors.absent,
  },
  triggerDisabled: {
    opacity: 0.5,
  },
  triggerText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.ink,
    marginRight: spacing[2],
  },
  placeholderText: {
    color: colors.inkTertiary,
  },
  errorText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.bodySmall,
    lineHeight: lineHeight.bodySmall,
    color: colors.absent,
    marginTop: spacing[1],
  },
  // Modal
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
    maxHeight: '60%',
  },
  sheetTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.h3,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing[2],
    paddingHorizontal: spacing[5],
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[5],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionRowSelected: {
    backgroundColor: colors.sandDark,
  },
  optionText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.ink,
  },
  optionTextSelected: {
    fontFamily: fontFamily.semiBold,
    color: colors.primary,
  },
});
