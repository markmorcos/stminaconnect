/**
 * Settings tab landing — sectioned list consolidating Account, Language,
 * About, Sign Out (everyone) and the Admin sub-pages (admins only). Each
 * row navigates to its destination; Sign Out routes through
 * `useSignOutWithGuard` to preserve the pending-writes confirmation.
 */
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useSignOutWithGuard } from '@/components/SignOutDialog';
import { TabHeader } from '@/components/TabHeader';
import { Card, Divider, Icon, Stack, Text, useTokens, type IconName } from '@/design';
import { useAuth } from '@/hooks/useAuth';

interface RowDef {
  key: string;
  label: string;
  icon: IconName;
  href: Href;
}

export default function SettingsTab() {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  const router = useRouter();
  const { servant, isLoading } = useAuth();
  const { request: requestSignOut, Dialog: SignOutGuardDialog } = useSignOutWithGuard();

  const appRows: RowDef[] = [
    { key: 'account', label: t('home.account'), icon: 'user', href: '/settings/account' },
    {
      key: 'language',
      label: t('settings.language.title'),
      icon: 'globe',
      href: '/settings/language',
    },
    {
      key: 'accessibility',
      label: t('settings.accessibility.title'),
      icon: 'heart',
      href: '/settings/accessibility',
    },
    { key: 'about', label: t('home.about'), icon: 'info', href: '/about' },
  ];

  const adminRows: RowDef[] =
    servant?.role === 'admin'
      ? [
          {
            key: 'counted-events',
            label: t('admin.countedEvents.title'),
            icon: 'calendar',
            href: '/admin/counted-events',
          },
          {
            key: 'alerts',
            label: t('admin.alerts.title'),
            icon: 'alertCircle',
            href: '/admin/alerts',
          },
          {
            key: 'servants',
            label: t('admin.servants.title'),
            icon: 'users',
            href: '/admin/servants',
          },
        ]
      : [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TabHeader title={t('tabs.settings')} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Section label={t('settings.section.app')}>
          <Card padding="none">
            {appRows.map((row, idx) => (
              <Row
                key={row.key}
                row={row}
                onPress={() => router.push(row.href)}
                isLast={idx === appRows.length - 1}
              />
            ))}
          </Card>
        </Section>

        {adminRows.length > 0 ? (
          <Section label={t('settings.section.admin')}>
            <Card padding="none">
              {adminRows.map((row, idx) => (
                <Row
                  key={row.key}
                  row={row}
                  onPress={() => router.push(row.href)}
                  isLast={idx === adminRows.length - 1}
                />
              ))}
            </Card>
          </Section>
        ) : null}

        <Divider />

        <Card padding="none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.signOut')}
            disabled={isLoading}
            onPress={() => requestSignOut()}
            style={({ pressed }) => [
              {
                opacity: pressed ? 0.7 : isLoading ? 0.5 : 1,
                padding: spacing.lg,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
              },
            ]}
          >
            <Icon name="arrowLeft" color={colors.error} size={20} />
            <Text variant="bodyLg" color={colors.error} style={{ fontWeight: '600' }}>
              {t('home.signOut')}
            </Text>
          </Pressable>
        </Card>
      </ScrollView>

      <SignOutGuardDialog />
    </View>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors, spacing } = useTokens();
  return (
    <Stack gap="sm">
      <Text variant="label" color={colors.textMuted} style={{ paddingHorizontal: spacing.sm }}>
        {label}
      </Text>
      {children}
    </Stack>
  );
}

function Row({ row, onPress, isLast }: { row: RowDef; onPress: () => void; isLast: boolean }) {
  const { colors, spacing } = useTokens();
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={row.label}
        onPress={onPress}
        style={({ pressed }) => [
          {
            opacity: pressed ? 0.7 : 1,
            padding: spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
          },
        ]}
      >
        <Icon name={row.icon} color={colors.text} size={20} />
        <Text variant="bodyLg" style={{ flex: 1 }}>
          {row.label}
        </Text>
        <Icon name="chevronRight" color={colors.textMuted} size={20} />
      </Pressable>
      {isLast ? null : <Divider />}
    </>
  );
}
