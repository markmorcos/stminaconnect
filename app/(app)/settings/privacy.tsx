/**
 * Settings → Privacy
 *
 * Sections:
 *   - Links to the published Privacy Policy and Terms of Service
 *     (open in the OS browser via `Linking`).
 *   - "Download my data" — calls `export_my_data` and shares the JSON
 *     payload via the OS share sheet.
 *   - "Delete my account" — typed-confirmation flow that runs
 *     `erase_my_account` followed by the `delete-auth-user` Edge
 *     Function, then signs the user out.
 *   - Consent history — read-only list of every accepted version.
 */
import { useMemo, useState } from 'react';
import { Alert, ScrollView, Share, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Button, Card, Divider, Input, Stack, Text, useTokens } from '@/design';
import { useAuth } from '@/hooks/useAuth';
import {
  eraseMyAccount,
  exportMyData,
  getMyLatestConsent,
  listMyConsentHistory,
  revokeConsent,
} from '@/services/api/compliance';
import { logger } from '@/utils/logger';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

export default function PrivacyScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  const { servant, signOut } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const consentHistoryQuery = useQuery({
    queryKey: ['compliance', 'myConsentHistory'],
    queryFn: listMyConsentHistory,
    staleTime: 30_000,
  });
  const latestConsentQuery = useQuery({
    queryKey: ['compliance', 'myLatestConsent'],
    queryFn: getMyLatestConsent,
    staleTime: 30_000,
  });

  const [exporting, setExporting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const expectedName = servant?.display_name?.trim() ?? '';
  const canConfirmDelete = !deleting && expectedName.length > 0 && typed.trim() === expectedName;
  const latestConsent = latestConsentQuery.data ?? null;
  const canRevoke = latestConsent !== null && !revoking;

  const onRevokeConsent = () => {
    if (!latestConsent) {
      Alert.alert(
        t('settings.privacy.revokeConfirmTitle'),
        t('settings.privacy.revokeNothingToRevoke'),
      );
      return;
    }
    Alert.alert(t('settings.privacy.revokeConfirmTitle'), t('settings.privacy.revokeConfirmBody'), [
      { text: t('common.actions.cancel'), style: 'cancel' },
      {
        text: t('settings.privacy.revokeConfirm'),
        style: 'destructive',
        onPress: async () => {
          setRevoking(true);
          try {
            await revokeConsent(latestConsent.id);
            // Drop both caches so the auth-layout guard re-fetches and
            // sees no current consent → routes to /consent on next
            // render. The consent-history list also refetches so the
            // revoked row shows up here when the user comes back.
            queryClient.setQueryData(['compliance', 'myLatestConsent'], null);
            await queryClient.invalidateQueries({
              queryKey: ['compliance', 'myConsentHistory'],
            });
            router.replace('/consent');
          } catch (e) {
            logger.warn('settings.privacy: revoke_consent failed', {
              error: e instanceof Error ? e.message : String(e),
            });
            setRevoking(false);
            Alert.alert(
              t('settings.privacy.revokeConfirmTitle'),
              t('settings.privacy.revokeFailed'),
            );
          }
        },
      },
    ]);
  };

  const onDownload = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const envelope = await exportMyData();
      const json = JSON.stringify(envelope, null, 2);
      const today = new Date().toISOString().slice(0, 10);
      await Share.share({
        message: json,
        title: `stmina-connect-my-data-${today}.json`,
      });
    } catch (e) {
      logger.warn('settings.privacy: export_my_data failed', {
        error: e instanceof Error ? e.message : String(e),
      });
      Alert.alert(t('settings.privacy.title'), t('settings.privacy.downloadFailed'));
    } finally {
      setExporting(false);
    }
  };

  const onConfirmDelete = async () => {
    if (!canConfirmDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await eraseMyAccount();
      // Local sign-out clears the session; the server-side servants row
      // and auth user are already gone.
      await signOut();
      setDeleteModalOpen(false);
      router.replace('/sign-in');
    } catch (e) {
      logger.warn('settings.privacy: erase_my_account failed', {
        error: e instanceof Error ? e.message : String(e),
      });
      setDeleteError(t('settings.privacy.deleteFailed'));
      setDeleting(false);
    }
  };

  const consentRows = useMemo(() => consentHistoryQuery.data ?? [], [consentHistoryQuery.data]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
    >
      <Card padding="md">
        <Stack gap="sm">
          <Button variant="ghost" onPress={() => router.push('/legal/privacy')}>
            {t('settings.privacy.viewPolicy')}
          </Button>
          <Divider />
          <Button variant="ghost" onPress={() => router.push('/legal/terms')}>
            {t('settings.privacy.viewTerms')}
          </Button>
        </Stack>
      </Card>

      <Card padding="md">
        <Stack gap="sm">
          <Text variant="bodyLg">{t('settings.privacy.downloadMyData')}</Text>
          <Text variant="bodySm" color={colors.textMuted}>
            {t('settings.privacy.downloadMyDataHint')}
          </Text>
          <Button variant="secondary" onPress={onDownload} loading={exporting}>
            {exporting
              ? t('settings.privacy.downloadStarted')
              : t('settings.privacy.downloadMyData')}
          </Button>
        </Stack>
      </Card>

      <Card padding="md">
        <Stack gap="sm">
          <Text variant="bodyLg">{t('settings.privacy.revokeConsent')}</Text>
          <Text variant="bodySm" color={colors.textMuted}>
            {t('settings.privacy.revokeConsentHint')}
          </Text>
          <Button
            variant="secondary"
            onPress={onRevokeConsent}
            disabled={!canRevoke}
            loading={revoking}
          >
            {t('settings.privacy.revokeConsent')}
          </Button>
        </Stack>
      </Card>

      <Card padding="md">
        <Stack gap="sm">
          <Text variant="bodyLg" color={colors.error}>
            {t('settings.privacy.deleteMyAccount')}
          </Text>
          <Text variant="bodySm" color={colors.textMuted}>
            {t('settings.privacy.deleteMyAccountHint')}
          </Text>
          <Button
            variant="destructive"
            onPress={() => {
              setTyped('');
              setDeleteError(null);
              setDeleteModalOpen(true);
            }}
          >
            {t('settings.privacy.deleteMyAccount')}
          </Button>
        </Stack>
      </Card>

      <Card padding="md">
        <Stack gap="sm">
          <Text variant="bodyLg">{t('settings.privacy.consentHistory')}</Text>
          {consentHistoryQuery.isPending ? (
            <Text variant="bodySm" color={colors.textMuted}>
              {t('settings.privacy.loading')}
            </Text>
          ) : consentRows.length === 0 ? (
            <Text variant="bodySm" color={colors.textMuted}>
              {t('settings.privacy.consentHistoryEmpty')}
            </Text>
          ) : (
            consentRows.map((row, idx) => (
              <View key={row.id}>
                <Text variant="bodySm">
                  {t('settings.privacy.consentRow', {
                    date: formatDate(row.accepted_at),
                    policy: row.policy_version,
                    terms: row.terms_version,
                  })}
                </Text>
                {idx < consentRows.length - 1 ? <Divider /> : null}
              </View>
            ))
          )}
        </Stack>
      </Card>

      {deleteModalOpen ? (
        <DeleteAccountModal
          expectedName={expectedName}
          typed={typed}
          onTypedChange={setTyped}
          canConfirm={canConfirmDelete}
          deleting={deleting}
          error={deleteError}
          onConfirm={onConfirmDelete}
          onCancel={() => {
            if (deleting) return;
            setDeleteModalOpen(false);
          }}
        />
      ) : null}
    </ScrollView>
  );
}

interface DeleteAccountModalProps {
  expectedName: string;
  typed: string;
  onTypedChange: (v: string) => void;
  canConfirm: boolean;
  deleting: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteAccountModal({
  expectedName,
  typed,
  onTypedChange,
  canConfirm,
  deleting,
  error,
  onConfirm,
  onCancel,
}: DeleteAccountModalProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
      }}
    >
      <Card padding="lg" style={{ width: '100%', maxWidth: 480 }}>
        <Stack gap="md">
          <Text variant="headingMd">{t('settings.privacy.deleteConfirmTitle')}</Text>
          <Text variant="body" color={colors.textMuted}>
            {t('settings.privacy.deleteConfirmBody')}
          </Text>
          <Input
            label={t('settings.privacy.deleteConfirmTypePrompt')}
            value={typed}
            onChangeText={onTypedChange}
            autoCapitalize="words"
            autoCorrect={false}
            accessibilityLabel={t('settings.privacy.deleteConfirmTypePrompt')}
            placeholder={expectedName}
          />
          {error ? (
            <Text variant="bodySm" color={colors.error}>
              {error}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button variant="ghost" style={{ flex: 1 }} onPress={onCancel} disabled={deleting}>
              {t('common.actions.cancel')}
            </Button>
            <Button
              variant="destructive"
              style={{ flex: 1 }}
              onPress={onConfirm}
              disabled={!canConfirm}
              loading={deleting}
            >
              {t('settings.privacy.deleteConfirm')}
            </Button>
          </View>
        </Stack>
      </Card>
    </View>
  );
}
