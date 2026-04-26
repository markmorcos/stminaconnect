/**
 * Notifications inbox.
 *
 * The list is hydrated by `MockNotificationService.refresh` (called on
 * mount / on auth state changes from the provider). Pull-to-refresh
 * re-runs the same path. Tapping a row calls `markRead` and follows the
 * `notificationRouter` deep link when one exists for the type.
 */
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, View } from 'react-native';
import { Appbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Card, EmptyState, Stack, Text, useTokens } from '@/design';
import { useNotificationService } from '@/services/notifications';
import { notificationRouter } from '@/services/notifications/notificationRouter';
import { useNotificationsStore } from '@/state/notificationsStore';
import type { Notification } from '@/services/notifications/types';

export default function NotificationsInbox() {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  const router = useRouter();
  const service = useNotificationService();

  const inbox = useNotificationsStore((s) => s.inbox);
  const [refreshing, setRefreshing] = useState(false);

  const sections = useMemo(() => {
    const unread: Notification[] = [];
    const read: Notification[] = [];
    for (const n of inbox) {
      (n.readAt ? read : unread).push(n);
    }
    const out: { title: string; data: Notification[] }[] = [];
    if (unread.length > 0) {
      out.push({ title: t('notifications.inbox.unreadHeader'), data: unread });
    }
    if (read.length > 0) {
      out.push({ title: t('notifications.inbox.readHeader'), data: read });
    }
    return out;
  }, [inbox, t]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await service.refresh();
    } finally {
      setRefreshing(false);
    }
  }, [service]);

  const onTap = useCallback(
    async (notification: Notification) => {
      if (!notification.readAt) {
        await service.markRead(notification.id).catch(() => null);
      }
      const route = notificationRouter(
        notification.type,
        notification.payload as Record<string, unknown> | undefined,
      );
      if (route && route !== '/notifications') {
        router.push(route);
      }
    },
    [router, service],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Appbar.Header style={{ backgroundColor: colors.surface }}>
        <Appbar.BackAction
          color={colors.text}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
        <Appbar.Content
          title={t('notifications.inbox.title')}
          titleStyle={{ color: colors.text, fontFamily: 'Inter-SemiBold', fontSize: 18 }}
        />
        <Appbar.Action
          icon="email-open-multiple-outline"
          color={colors.text}
          accessibilityLabel={t('notifications.inbox.markAllRead')}
          onPress={() => {
            void service.markAllRead().catch(() => null);
          }}
        />
      </Appbar.Header>

      {inbox.length === 0 ? (
        <EmptyState icon="bell" title={t('notifications.inbox.empty')} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderSectionHeader={({ section }) => (
            <Text
              variant="label"
              color={colors.textMuted}
              style={{ paddingTop: spacing.sm, paddingBottom: spacing.xs }}
            >
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => <Row notification={item} onPress={() => void onTap(item)} />}
          stickySectionHeadersEnabled={false}
        />
      )}
    </View>
  );
}

function Row({ notification, onPress }: { notification: Notification; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  const isUnread = !notification.readAt;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(`notifications.types.${notification.type}.title`)}
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
    >
      <Card
        padding="md"
        style={{
          backgroundColor: isUnread ? colors.surfaceElevated : colors.surface,
          borderLeftWidth: isUnread ? 3 : 0,
          borderLeftColor: colors.primary,
        }}
      >
        <Stack gap="xs">
          <Text variant="bodyLg" style={{ fontWeight: isUnread ? '700' : '500' }}>
            {t(`notifications.types.${notification.type}.title`)}
          </Text>
          <Text variant="body" color={colors.textMuted}>
            {bodyFor(notification, t)}
          </Text>
          <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
            {new Date(notification.createdAt).toLocaleString()}
          </Text>
        </Stack>
      </Card>
    </Pressable>
  );
}

function bodyFor(notification: Notification, t: ReturnType<typeof useTranslation>['t']): string {
  if (notification.type === 'system') {
    const message = notification.payload?.message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return t(`notifications.types.${notification.type}.body`);
}
