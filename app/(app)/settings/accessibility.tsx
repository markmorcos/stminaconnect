/**
 * Accessibility settings — surfaces user-controllable a11y toggles.
 *
 * Today: a single Haptics on/off switch backed by `accessibilityStore`.
 * Reduce-motion is intentionally OS-driven (every animation already
 * honours `AccessibilityInfo.isReduceMotionEnabled()`) — adding an
 * in-app override would split the source of truth and surprise users.
 *
 * The screen is read-only when the store hasn't hydrated; the disabled
 * Switch state matches the OS pattern for "loading preferences".
 */
import { ScrollView, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card, Stack, Text, useTokens } from '@/design';
import { useAccessibilityStore } from '@/state/accessibilityStore';

export default function AccessibilitySettingsScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  const hydrated = useAccessibilityStore((s) => s.hydrated);
  const hapticsEnabled = useAccessibilityStore((s) => s.hapticsEnabled);
  const setHapticsEnabled = useAccessibilityStore((s) => s.setHapticsEnabled);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
    >
      <Stack gap="sm">
        <Text variant="label" color={colors.textMuted}>
          {t('settings.accessibility.feedbackSection')}
        </Text>
        <Card padding="lg">
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text variant="bodyLg" style={{ fontWeight: '600' }}>
                {t('settings.accessibility.hapticsLabel')}
              </Text>
              <Text variant="bodySm" color={colors.textMuted}>
                {t('settings.accessibility.hapticsHint')}
              </Text>
            </View>
            <Switch
              accessibilityLabel={t('settings.accessibility.hapticsLabel')}
              value={hapticsEnabled}
              disabled={!hydrated}
              onValueChange={setHapticsEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </Card>
      </Stack>

      <Stack gap="sm">
        <Text variant="label" color={colors.textMuted}>
          {t('settings.accessibility.motionSection')}
        </Text>
        <Card padding="lg">
          <Stack gap="xs">
            <Text variant="bodyLg" style={{ fontWeight: '600' }}>
              {t('settings.accessibility.reduceMotionLabel')}
            </Text>
            <Text variant="bodySm" color={colors.textMuted}>
              {t('settings.accessibility.reduceMotionHint')}
            </Text>
          </Stack>
        </Card>
      </Stack>
    </ScrollView>
  );
}
