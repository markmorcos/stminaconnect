/**
 * Shared header for the four root tab screens (Home, Persons, Follow-ups,
 * Settings). Renders the screen title, a notifications bell with unread
 * badge that routes to /notifications, and — only in dev/preview builds
 * (`__DEV__` or `EXPO_PUBLIC_SHOW_DEV_TOOLS=true`) — an overflow menu
 * containing development tools (DB Inspector, Showcase). In production
 * builds the overflow icon does not render at all, so the header has just
 * title + bell.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Appbar, Badge as PaperBadge, Menu } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import { useTokens } from '@/design';
import { useNotificationsStore } from '@/state/notificationsStore';
import { SHOW_DEV_TOOLS } from './devToolsFlag';

export interface TabHeaderProps {
  title: string;
}

export function TabHeader({ title }: TabHeaderProps) {
  const { t } = useTranslation();
  const { colors } = useTokens();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);

  return (
    <Appbar.Header style={{ backgroundColor: colors.surface }}>
      <Appbar.Content
        title={title}
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
      {SHOW_DEV_TOOLS ? (
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
              router.push('/dev/db');
            }}
            title="DB Inspector"
          />
          <Menu.Item
            onPress={() => {
              setMenuOpen(false);
              router.push('/dev/showcase');
            }}
            title="Showcase"
          />
        </Menu>
      ) : null}
    </Appbar.Header>
  );
}
