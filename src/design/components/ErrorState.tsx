/**
 * ErrorState — generic per-section / per-screen failure surface.
 *
 * Mirrors the visual language of `EmptyState` (centred icon + heading +
 * optional body) but defaults to an alert icon and exposes a Retry
 * affordance. Use it whenever a TanStack Query, RPC, or async action
 * fails non-fatally and the user can recover by trying again.
 *
 * a11y: the icon is announced via `accessibilityLabel`, the title is
 * announced as a heading, and the Retry button forwards its own a11y
 * wiring through the design-system Button.
 */
import { View, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '../Icon';
import { useTokens } from '../ThemeProvider';
import { Button } from './Button';
import { Text } from './Text';

export interface ErrorStateProps {
  /** Defaults to `alertCircle` — feature screens rarely override this. */
  icon?: IconName;
  title: string;
  body?: string;
  /** Defaults to a generic "Retry" string supplied by the consumer. */
  retryLabel?: string;
  onRetry?: () => void;
  style?: ViewStyle;
}

export function ErrorState({
  icon = 'alertCircle',
  title,
  body,
  retryLabel,
  onRetry,
  style,
}: ErrorStateProps) {
  const { colors, spacing } = useTokens();
  return (
    <View
      style={[
        {
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.xl,
        },
        style,
      ]}
    >
      <View style={{ marginBottom: spacing.md }}>
        <Icon name={icon} size={40} color={colors.error} />
      </View>
      <Text variant="headingMd" align="center" accessibilityRole="header">
        {title}
      </Text>
      {body ? (
        <Text
          variant="body"
          color={colors.textMuted}
          align="center"
          style={{ marginTop: spacing.xs }}
        >
          {body}
        </Text>
      ) : null}
      {retryLabel && onRetry ? (
        <View style={{ marginTop: spacing.lg }}>
          <Button variant="secondary" onPress={onRetry}>
            {retryLabel}
          </Button>
        </View>
      ) : null}
    </View>
  );
}
