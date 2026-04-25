/**
 * Sheet / BottomSheet — Paper Modal positioned at the bottom of the
 * screen with a grab-handle. For non-blocking flows (filters, picker
 * sheets); for blocking confirmations use `Modal`.
 *
 * a11y: forwards `accessibilityLabel`. The grab-handle is decorative
 * and hidden from screen readers.
 */
import { type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { Modal as PaperModal, Portal } from 'react-native-paper';

import { useTokens } from '../ThemeProvider';

export interface SheetProps {
  visible: boolean;
  onDismiss?: () => void;
  children: ReactNode;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function Sheet({ visible, onDismiss, children, style, accessibilityLabel }: SheetProps) {
  const { colors, radii, spacing } = useTokens();
  return (
    <Portal>
      <PaperModal
        visible={visible}
        onDismiss={onDismiss}
        style={{ justifyContent: 'flex-end' }}
        contentContainerStyle={[
          {
            backgroundColor: colors.surface,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            paddingTop: spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xl,
          },
          style,
        ]}
      >
        <View accessibilityLabel={accessibilityLabel}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={{
              alignSelf: 'center',
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
              marginBottom: spacing.md,
            }}
          />
          {children}
        </View>
      </PaperModal>
    </Portal>
  );
}
