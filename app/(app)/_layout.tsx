import { ActivityIndicator, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { NotificationBanner } from '@/components/NotificationBanner';
import { SyncConflictSnackbar } from '@/components/SyncConflictSnackbar';
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator';
import { Text, useTokens } from '@/design';
import { useInvalidateOnPull } from '@/services/sync/useInvalidateOnPull';
import { useSyncBootstrap } from '@/services/sync/useSyncBootstrap';
import { useSyncState } from '@/services/sync/SyncEngine';
import { useAuthStore } from '@/state/authStore';

export default function AppLayout() {
  const session = useAuthStore((s) => s.session);
  const { colors, spacing } = useTokens();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const hasCompletedFirstPull = useSyncState((s) => s.hasCompletedFirstPull);
  // Same reasoning as `(auth)/_layout.tsx` — gate on session only.
  useSyncBootstrap();
  useInvalidateOnPull();
  if (!session) return <Redirect href="/sign-in" />;

  // Block first-launch with a spinner until the SyncEngine completes
  // its initial pull. Once cached, subsequent launches render
  // immediately even when offline (cache-first).
  if (!hasCompletedFirstPull) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          padding: spacing.lg,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="body" color={colors.textMuted} style={{ marginTop: spacing.md }}>
          {t('sync.firstLaunchLoading')}
        </Text>
      </View>
    );
  }

  // The Stack renders full-screen; each screen's header (Paper Appbar
  // or native stack) handles its own status-bar inset via the OS. The
  // sync indicator + notification banner sit in a floating overlay so
  // they don't push the Stack down (which would cause double padding
  // for nested layouts whose native headers auto-inset themselves).
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>

      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          paddingTop: insets.top,
        }}
      >
        <NotificationBanner />
        {/*
          The sync indicator is a Messenger-style status bar: a thin,
          full-width strip that auto-hides when there's nothing to
          report. When visible it briefly overlays the top of the
          underlying screen's header — same trade-off Messenger /
          WhatsApp / Telegram make for connectivity strips. The
          `pointerEvents="box-none"` overlay lets taps fall through to
          the screen's own header when the bar is hidden.
        */}
        <SyncStatusIndicator />
      </View>

      <SyncConflictSnackbar />
    </View>
  );
}
