/**
 * EmptyState — icon + headingMd title + body description, plus an
 * optional CTA Button. Centred vertically and horizontally.
 *
 * a11y: the title is announced as a heading; the CTA Button forwards
 * its own a11y wiring.
 */
import { View, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '../Icon';
import { useTokens } from '../ThemeProvider';
import { Button } from './Button';
import { Text } from './Text';

export interface EmptyStateProps {
  icon: IconName;
  title: string;
  body?: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
  style?: ViewStyle;
}

export function EmptyState({ icon, title, body, ctaLabel, onCtaPress, style }: EmptyStateProps) {
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
        <Icon name={icon} size={40} color={colors.textMuted} />
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
      {ctaLabel && onCtaPress ? (
        <View style={{ marginTop: spacing.lg }}>
          <Button onPress={onCtaPress}>{ctaLabel}</Button>
        </View>
      ) : null}
    </View>
  );
}
