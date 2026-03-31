import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';

import { colors } from '../theme/colors';
import { fontFamily, fontSize } from '../theme/typography';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';

export interface FilterChip {
  key: string;
  label: string;
}

interface FilterChipsProps {
  chips: FilterChip[];
  selected: string;
  onSelect: (key: string) => void;
}

export function FilterChips({ chips, selected, onSelect }: FilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      style={styles.scroll}
    >
      {chips.map((chip) => {
        const isSelected = chip.key === selected;
        return (
          <Pressable
            key={chip.key}
            style={[styles.chip, isSelected && styles.chipSelected]}
            onPress={() => onSelect(chip.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
          >
            <Text
              style={[styles.chipText, isSelected && styles.chipTextSelected]}
            >
              {chip.label}
            </Text>
          </Pressable>
        );
      })}
      {/* Trailing spacer so last chip isn't clipped */}
      <View style={styles.trailingSpace} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2],
    flexDirection: 'row',
    gap: spacing[2],
  },
  chip: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2] - 2,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.bodySmall,
    color: colors.inkSecondary,
  },
  chipTextSelected: {
    color: colors.white,
  },
  trailingSpace: {
    width: spacing[3],
  },
});
