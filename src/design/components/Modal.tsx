/**
 * Modal — Paper Modal themed against tokens. Use for blocking
 * confirmations or critical decisions; for non-blocking actions, prefer
 * `Sheet`.
 *
 * a11y: forwards `accessibilityLabel` to the surface. Set
 * `dismissable={false}` for confirmation flows.
 */
import { type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { Modal as PaperModal, Portal } from 'react-native-paper';

import { useTokens } from '../ThemeProvider';

export interface ModalProps {
  visible: boolean;
  onDismiss?: () => void;
  dismissable?: boolean;
  children: ReactNode;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function Modal({
  visible,
  onDismiss,
  dismissable = true,
  children,
  style,
  accessibilityLabel,
}: ModalProps) {
  const { colors, radii, spacing } = useTokens();
  return (
    <Portal>
      <PaperModal
        visible={visible}
        onDismiss={onDismiss}
        dismissable={dismissable}
        contentContainerStyle={[
          {
            backgroundColor: colors.surface,
            borderRadius: radii.lg,
            padding: spacing.lg,
            margin: spacing.lg,
          },
          style,
        ]}
      >
        <View accessibilityLabel={accessibilityLabel}>{children}</View>
      </PaperModal>
    </Portal>
  );
}
