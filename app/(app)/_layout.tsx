import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { NotificationBanner } from '@/components/NotificationBanner';
import { SyncConflictSnackbar } from '@/components/SyncConflictSnackbar';
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator';
import { Snackbar, Text, useTokens } from '@/design';
import { getMyLatestConsent } from '@/services/api/compliance';
import { triggerCalendarSyncIfStale } from '@/services/api/events';
import { CURRENT_LEGAL_VERSIONS } from '@/services/legal/getLegalDoc';
import { useInvalidateOnPull } from '@/services/sync/useInvalidateOnPull';
import { useSyncBootstrap } from '@/services/sync/useSyncBootstrap';
import { useSyncState } from '@/services/sync/SyncEngine';
import { logger } from '@/utils/logger';
import { useAccessibilityStore } from '@/state/accessibilityStore';
import { useAuthStore } from '@/state/authStore';

export default function AppLayout() {
  const session = useAuthStore((s) => s.session);
  const reviewerJustSignedIn = useAuthStore((s) => s.reviewerJustSignedIn);
  const clearReviewerJustSignedIn = useAuthStore((s) => s.clearReviewerJustSignedIn);
  const { colors, spacing } = useTokens();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const hasCompletedFirstPull = useSyncState((s) => s.hasCompletedFirstPull);

  // Fetch the latest consent acceptance so the guard below can compare
  // against the published versions. We gate on `session` to skip the
  // RPC call entirely when signed out (it would 401). The query is
  // global by `auth.uid()` server-side; the queryKey doesn't need to
  // include the user id because the supabase client is single-tenant
  // per session and we invalidate on sign-out.
  const consentQuery = useQuery({
    queryKey: ['compliance', 'myLatestConsent'],
    queryFn: getMyLatestConsent,
    enabled: !!session,
    staleTime: 60_000,
  });
  // Same reasoning as `(auth)/_layout.tsx` — gate on session only.
  useSyncBootstrap();
  useInvalidateOnPull();
  // Hydrate the haptics-enabled toggle from AsyncStorage so the wrapper
  // reflects the user's preference from the very first interaction.
  const hydrateA11y = useAccessibilityStore((s) => s.hydrate);
  useEffect(() => {
    void hydrateA11y();
  }, [hydrateA11y]);

  // Fire a calendar refresh once per app open. The server-side RPC
  // is rate-limited to once every 10 minutes, so re-mounting this
  // layout (e.g. after a deep link) doesn't hammer Google Calendar.
  // Failures are best-effort — events stay readable from the local
  // cache; the next pg_cron tick (every 30 min) is the safety net.
  useEffect(() => {
    if (!session) return;
    triggerCalendarSyncIfStale().catch((e: unknown) => {
      logger.warn('calendar sync on app open failed', {
        error: e instanceof Error ? e.message : String(e),
      });
    });
  }, [session?.user.id]);

  if (!session) return <Redirect href="/sign-in" />;

  // Consent gate: from `add-gdpr-compliance` onward, no authenticated
  // route may render until the user's most recent acceptance matches
  // both the current Privacy and Terms versions. While the consent
  // query is in flight we render a spinner (same posture as the
  // first-launch sync block below) to avoid a flash of authenticated
  // content. A query error is treated as "no acceptance" and the user
  // is redirected to the consent screen — better to over-prompt than
  // bypass the gate on a transient RPC failure.
  if (consentQuery.isPending) {
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
      </View>
    );
  }
  const consent = consentQuery.data ?? null;
  const consentMatches =
    consent !== null &&
    consent.policy_version === CURRENT_LEGAL_VERSIONS.privacy &&
    consent.terms_version === CURRENT_LEGAL_VERSIONS.terms;
  if (!consentMatches) {
    return <Redirect href="/consent" />;
  }

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
        <Stack
          screenOptions={{
            headerShown: false,
            // slide-from-right for push routes; modal-presented routes
            // (e.g. on-break, follow-up) declare `presentation: 'modal'`
            // in their own screen options to slide up + fade instead.
            animation: 'slide_from_right',
            animationDuration: 250,
          }}
        />
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

      {/*
        One-shot toast confirming the reviewer-bypass auto-sign-in. Fires
        only when `reviewerJustSignedIn` is set by the auth store after a
        successful `verifyOtp` against the configured reviewer email — so
        real users never see this. Auto-clears on dismiss / 6 s timeout
        so it doesn't reappear on subsequent renders.
       */}
      <Snackbar
        visible={reviewerJustSignedIn}
        onDismiss={clearReviewerJustSignedIn}
        duration={6000}
      >
        {t('auth.reviewer.signedInToast')}
      </Snackbar>
    </View>
  );
}
