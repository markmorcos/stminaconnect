import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Appbar, Badge as PaperBadge, Banner, Menu } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import { Card, Snackbar, Stack, Text, useTokens } from '@/design';
import { useAuth } from '@/hooks/useAuth';
import { missingSupabaseEnvVars } from '@/services/api/supabase';
import { useNotificationsStore } from '@/state/notificationsStore';

const SHOW_DEV_TOOLS = __DEV__ || process.env.EXPO_PUBLIC_SHOW_DEV_TOOLS === 'true';

export default function Home() {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  const router = useRouter();
  const { servant, signOut, isLoading } = useAuth();
  const params = useLocalSearchParams<{ welcome?: string }>();
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const missingUrl = missingSupabaseEnvVars.includes('EXPO_PUBLIC_SUPABASE_URL');
  const greeting = servant?.display_name?.trim() || servant?.email || '';
  const unreadCount = useNotificationsStore((s) => s.unreadCount);

  useEffect(() => {
    // Quick Add navigates back here with `?welcome=<first>` set; mirror
    // it into local state so we can clear the route param immediately
    // (otherwise the snackbar would re-appear on every re-render and
    // back-navigation).
    if (typeof params.welcome === 'string' && params.welcome.length > 0) {
      setWelcomeName(params.welcome);
      router.setParams({ welcome: undefined });
    }
  }, [params.welcome, router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Appbar.Header style={{ backgroundColor: colors.surface }}>
        <Appbar.Content
          title={t('home.title')}
          titleStyle={{ color: colors.text, fontFamily: 'Inter-SemiBold', fontSize: 18 }}
        />
        <View>
          <Appbar.Action
            icon="bell-outline"
            color={colors.text}
            accessibilityLabel={t('home.notifications')}
            onPress={() => router.push('/notifications')}
          />
          {unreadCount > 0 ? (
            <PaperBadge
              size={16}
              style={{ position: 'absolute', top: 6, right: 6 }}
              accessibilityLabel={`${unreadCount} unread`}
            >
              {unreadCount > 99 ? '99+' : String(unreadCount)}
            </PaperBadge>
          ) : null}
        </View>
        <Menu
          visible={menuOpen}
          onDismiss={() => setMenuOpen(false)}
          anchor={
            <Appbar.Action
              icon="dots-vertical"
              color={colors.text}
              accessibilityLabel={t('home.menu')}
              onPress={() => setMenuOpen(true)}
            />
          }
        >
          <Menu.Item
            onPress={() => {
              setMenuOpen(false);
              router.push('/about');
            }}
            title={t('home.about')}
          />
          <Menu.Item
            onPress={() => {
              setMenuOpen(false);
              router.push('/settings/language');
            }}
            title={t('home.settings')}
          />
          <Menu.Item
            onPress={() => {
              setMenuOpen(false);
              router.push('/settings/account');
            }}
            title={t('home.account')}
          />
          {servant?.role === 'admin' ? (
            <Menu.Item
              onPress={() => {
                setMenuOpen(false);
                router.push('/admin/counted-events');
              }}
              title={t('admin.countedEvents.title')}
            />
          ) : null}
          <Menu.Item
            onPress={() => {
              setMenuOpen(false);
              void signOut();
            }}
            disabled={isLoading}
            title={t('home.signOut')}
          />
        </Menu>
      </Appbar.Header>

      {missingUrl ? (
        <Banner visible icon="alert-circle">
          {t('home.supabaseMissing')}
        </Banner>
      ) : null}

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <Pressable
          onLongPress={() => {
            if (SHOW_DEV_TOOLS) router.push('/dev/showcase');
          }}
          delayLongPress={600}
        >
          {greeting ? (
            <Text variant="bodyLg" color={colors.textMuted}>
              {t('home.signedInAs', { name: greeting })}
            </Text>
          ) : null}
        </Pressable>

        <Tile
          title={t('home.quickAdd')}
          subtitle={t('home.quickAddSubtitle')}
          variant="primary"
          onPress={() => router.push('/registration/quick-add')}
        />
        <Tile
          title={t('home.registerFull')}
          subtitle={t('home.registerFullSubtitle')}
          variant="secondary"
          onPress={() => router.push('/registration/full')}
        />
        <Tile
          title={t('persons.list.title')}
          subtitle={t('home.personsListSubtitle')}
          variant="secondary"
          onPress={() => router.push('/persons')}
        />
      </ScrollView>

      <Snackbar
        visible={welcomeName !== null}
        onDismiss={() => setWelcomeName(null)}
        duration={4000}
      >
        {welcomeName ? t('registration.quickAdd.successWelcome', { firstName: welcomeName }) : ''}
      </Snackbar>
    </View>
  );
}

function Tile({
  title,
  subtitle,
  onPress,
  variant,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
  variant: 'primary' | 'secondary';
}) {
  const { colors, spacing } = useTokens();
  const minHeight = variant === 'primary' ? 140 : 96;
  const bg = variant === 'primary' ? colors.primary : colors.surface;
  const titleColor = variant === 'primary' ? colors.textInverse : colors.text;
  const subColor = variant === 'primary' ? colors.textInverse : colors.textMuted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
    >
      <Card padding="lg" style={{ backgroundColor: bg, minHeight }}>
        <Stack gap="xs" justify="center" style={{ flex: 1, padding: spacing.xs }}>
          <Text
            variant={variant === 'primary' ? 'displayMd' : 'headingMd'}
            color={titleColor}
            style={{ fontWeight: '700' }}
          >
            {title}
          </Text>
          <Text variant="body" color={subColor}>
            {subtitle}
          </Text>
        </Stack>
      </Card>
    </Pressable>
  );
}
