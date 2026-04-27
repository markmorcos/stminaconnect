/**
 * Top-of-screen banner driven by `notificationsStore.bannerNotification`.
 * Visible whenever the store has a non-null banner; the store auto-clears
 * after 8s. Tapping "View" runs the deep-link route from
 * `notificationRouter` and marks the notification read; "Dismiss" only
 * clears the banner — the notification stays unread in the inbox.
 */
import { Banner } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useNotificationsStore } from '@/state/notificationsStore';
import { useNotificationService } from '@/services/notifications';
import { notificationRouter } from '@/services/notifications/notificationRouter';
import { useTokens } from '@/design';

export function NotificationBanner() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTokens();
  const service = useNotificationService();
  const banner = useNotificationsStore((s) => s.bannerNotification);
  const dismiss = useNotificationsStore((s) => s.dismissBanner);

  const visible = banner !== null;
  const params = (banner?.payload ?? {}) as Record<string, unknown>;
  const title = banner ? t(`notifications.types.${banner.type}.title`, params) : '';
  const body = banner ? t(`notifications.types.${banner.type}.body`, params) : '';

  return (
    <Banner
      visible={visible}
      icon="bell"
      style={{ backgroundColor: colors.surface }}
      actions={[
        {
          label: t('notifications.banner.dismissAction'),
          onPress: () => dismiss(),
        },
        {
          label: t('notifications.banner.viewAction'),
          onPress: () => {
            if (!banner) return;
            const route = notificationRouter(
              banner.type,
              banner.payload as Record<string, unknown> | undefined,
            );
            void service.markRead(banner.id).catch(() => {
              // best effort: store state is already updated optimistically
              // in markRead via the store call inside the service.
            });
            dismiss();
            if (route) router.push(route);
          },
        },
      ]}
    >
      {title}
      {body ? `\n${body}` : ''}
    </Banner>
  );
}
