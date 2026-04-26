/**
 * About screen — read-only app + church identity, credits, and links.
 *
 * Long-pressing the App identity row navigates to `/dev/showcase`
 * when running in a dev build (or with `EXPO_PUBLIC_SHOW_DEV_TOOLS`).
 */
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import '@/i18n';
import { Card, Divider, Stack, Text, useTokens } from '@/design';
import { church } from '@/branding/church';

const SHOW_DEV_TOOLS = __DEV__ || process.env.EXPO_PUBLIC_SHOW_DEV_TOOLS === 'true';

const BUILD_SHA =
  process.env.EXPO_PUBLIC_BUILD_SHA ??
  (Constants.expoConfig?.extra as { buildSha?: string } | undefined)?.buildSha ??
  null;

export default function About() {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const version = Constants.expoConfig?.version ?? '0.0.0';
  const visibleAcknowledgments = church.acknowledgments.filter((a) => a.optIn);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: insets.top + spacing.lg,
          paddingBottom: spacing['3xl'],
          gap: spacing.lg,
        }}
      >
        <Text variant="displayMd" accessibilityRole="header">
          {t('branding.about.title')}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('branding.about.app')}
          onLongPress={() => {
            if (SHOW_DEV_TOOLS) router.push('/dev/showcase');
          }}
          delayLongPress={600}
        >
          <Card>
            <Stack gap="sm">
              <Text variant="label" color={colors.textMuted}>
                {t('branding.about.app')}
              </Text>
              <Text variant="headingMd">{t('branding.appName')}</Text>
              <Row label={t('branding.about.version')} value={version} />
              {BUILD_SHA ? <Row label={t('branding.about.buildSha')} value={BUILD_SHA} /> : null}
            </Stack>
          </Card>
        </Pressable>

        <Card>
          <Stack gap="sm">
            <Text variant="label" color={colors.textMuted}>
              {t('branding.about.church')}
            </Text>
            <Text variant="headingMd">{church.name}</Text>
            <Row label={t('branding.about.address')} value={church.address} />
            <Row
              label={t('branding.about.languagesSpoken')}
              value={church.languagesSpoken.join(' · ')}
            />
            {church.contact.email ? (
              <Row label={t('branding.about.contact')} value={church.contact.email} />
            ) : null}
          </Stack>
        </Card>

        <Card>
          <Stack gap="sm">
            <Text variant="label" color={colors.textMuted}>
              {t('branding.about.credits')}
            </Text>
            <CreditGroup heading={t('branding.about.fonts')}>
              <Text variant="bodySm" color={colors.textMuted}>
                Inter — SIL Open Font License 1.1
              </Text>
              <Text variant="bodySm" color={colors.textMuted}>
                IBM Plex Sans Arabic — SIL Open Font License 1.1
              </Text>
            </CreditGroup>
            <Divider />
            <CreditGroup heading={t('branding.about.icons')}>
              <Text variant="bodySm" color={colors.textMuted}>
                Lucide — ISC License
              </Text>
            </CreditGroup>
            <Divider />
            <CreditGroup heading={t('branding.about.uiLibrary')}>
              <Text variant="bodySm" color={colors.textMuted}>
                React Native Paper — MIT License
              </Text>
            </CreditGroup>
            {visibleAcknowledgments.length > 0 ? (
              <>
                <Divider />
                <CreditGroup heading={t('branding.about.acknowledgments')}>
                  {visibleAcknowledgments.map((a) => (
                    <Text key={a.name} variant="bodySm" color={colors.textMuted}>
                      {a.role ? `${a.name} — ${a.role}` : a.name}
                    </Text>
                  ))}
                </CreditGroup>
              </>
            ) : null}
          </Stack>
        </Card>

        <Card>
          <Stack gap="sm">
            <Text variant="bodySm" color={colors.accent}>
              {t('branding.about.privacy')}
            </Text>
            <Text variant="bodySm" color={colors.accent}>
              {t('branding.about.terms')}
            </Text>
          </Stack>
        </Card>
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { colors } = useTokens();
  return (
    <Stack gap="xs">
      <Text variant="caption" color={colors.textMuted}>
        {label}
      </Text>
      <Text variant="body">{value}</Text>
    </Stack>
  );
}

function CreditGroup({ heading, children }: { heading: string; children: React.ReactNode }) {
  const { colors } = useTokens();
  return (
    <Stack gap="xs">
      <Text variant="caption" color={colors.textMuted}>
        {heading}
      </Text>
      {children}
    </Stack>
  );
}
