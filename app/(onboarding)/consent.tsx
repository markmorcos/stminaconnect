/**
 * GDPR consent screen — first-launch (and post-version-bump) gate. The
 * user must scroll the Privacy + Terms text, tick the agreement box,
 * and tap "Accept and continue" to record acceptance and reach the
 * authenticated app. "Decline" opens a confirm dialog and signs out.
 */
import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Checkbox } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { Button, Card, Stack, Text, useTokens } from '@/design';
import { LegalDocBody } from '@/components/LegalDocBody';
import { recordConsent } from '@/services/api/compliance';
import { CURRENT_LEGAL_VERSIONS, getLegalDoc } from '@/services/legal/getLegalDoc';
import type { LegalLang } from '@/services/legal/offlineLegalDocs';
import { useAuthStore } from '@/state/authStore';
import { logger } from '@/utils/logger';

const SCROLL_BOTTOM_THRESHOLD_PX = 24;

function isLegalLang(lang: string): lang is LegalLang {
  return lang === 'en' || lang === 'ar' || lang === 'de';
}

export default function ConsentScreen() {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTokens();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  // Read the active language from useTranslation (react-i18next subscribes
  // to languageChanged for us). Re-renders pick up the right markdown body
  // when the user switches language via Settings → Language.
  const docLang: LegalLang = isLegalLang(i18n.language) ? (i18n.language as LegalLang) : 'en';
  const signOut = useAuthStore((s) => s.signOut);

  // Bundled docs are sync — no loading state needed. Recompute on
  // language switch so RTL/LTR + script changes (Arabic) take effect.
  const privacy = getLegalDoc('privacy', docLang);
  const terms = getLegalDoc('terms', docLang);

  const [agreed, setAgreed] = useState(false);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submittedRef = useRef(false);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - SCROLL_BOTTOM_THRESHOLD_PX
    ) {
      setScrolledToEnd(true);
    }
  }, []);

  const onAccept = async () => {
    if (submittedRef.current || submitting) return;
    submittedRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const policyVersion = privacy.version ?? CURRENT_LEGAL_VERSIONS.privacy;
      const termsVersion = terms.version ?? CURRENT_LEGAL_VERSIONS.terms;
      const row = await recordConsent(policyVersion, termsVersion);
      // Prime the cache so the auth-layout consent guard sees the new
      // acceptance immediately on its next render — without this, the
      // 60-second TanStack Query staleTime would bounce the user back
      // to this screen until restart.
      queryClient.setQueryData(['compliance', 'myLatestConsent'], row);
      // Also invalidate the consent-history list so Settings → Privacy
      // shows the row right away if the user navigates there next.
      void queryClient.invalidateQueries({ queryKey: ['compliance', 'myConsentHistory'] });
      router.replace('/');
    } catch (e) {
      logger.warn('consent: record_consent failed', {
        error: e instanceof Error ? e.message : String(e),
      });
      submittedRef.current = false;
      setSubmitting(false);
      setSubmitError(t('consent.submitFailed'));
    }
  };

  const onDecline = () => {
    Alert.alert(t('consent.declineConfirm.title'), t('consent.declineConfirm.body'), [
      { text: t('consent.declineConfirm.cancel'), style: 'cancel' },
      {
        text: t('consent.declineConfirm.confirm'),
        style: 'destructive',
        onPress: () => {
          void signOut();
        },
      },
    ]);
  };

  const acceptDisabled = !agreed || !scrolledToEnd || submitting;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top + spacing.lg,
        paddingBottom: insets.bottom,
      }}
    >
      <Stack gap="md" style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
        <Text variant="headingLg">{t('consent.title')}</Text>
        <Text variant="body" color={colors.textMuted}>
          {t('consent.summaryIntro')}
        </Text>
      </Stack>

      <ScrollView
        testID="consent-scroll"
        onScroll={handleScroll}
        scrollEventThrottle={64}
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.lg,
        }}
        style={{ flex: 1 }}
      >
        <Stack gap="lg">
          <Card padding="md">
            <LegalDocBody body={privacy.body} />
          </Card>
          <Card padding="md">
            <LegalDocBody body={terms.body} />
          </Card>
        </Stack>
      </ScrollView>

      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          gap: spacing.sm,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        {!scrolledToEnd ? (
          <Text variant="bodySm" color={colors.textMuted}>
            {t('consent.scrollHint')}
          </Text>
        ) : null}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
          }}
        >
          <Checkbox
            status={agreed ? 'checked' : 'unchecked'}
            onPress={() => setAgreed((v) => !v)}
            disabled={!scrolledToEnd}
          />
          <Text variant="body" style={{ flex: 1 }}>
            {t('consent.agreeCheckbox')}
          </Text>
        </View>
        {submitError ? (
          <Text variant="bodySm" color={colors.error}>
            {submitError}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.md }}>
          <Button
            variant="ghost"
            size="md"
            onPress={onDecline}
            style={{ flex: 1 }}
            disabled={submitting}
          >
            {t('consent.decline')}
          </Button>
          <Button
            variant="primary"
            size="md"
            onPress={onAccept}
            disabled={acceptDisabled}
            loading={submitting}
            style={{ flex: 1 }}
          >
            {t('consent.accept')}
          </Button>
        </View>
      </View>
    </View>
  );
}
