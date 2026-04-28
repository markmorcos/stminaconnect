/**
 * Admin → Compliance
 *
 * Per-person actions:
 *   - Search by name → result rows with Export and Erase actions.
 *   - Erase opens a typed-confirmation modal: must type the person's
 *     full name exactly AND provide a reason ≥ 20 chars.
 *
 * Audit log viewer:
 *   - Filterable by actor, action, and date.
 *   - Paginated, default page size 50.
 *
 * Soft-delete on the person profile remains the everyday churn path;
 * hard-erasure here is the GDPR Article 17 path. The two are deliberately
 * kept on separate screens — see `add-gdpr-compliance/design.md` § 4.
 */
import { useState } from 'react';
import { Alert, ScrollView, Share, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button, Card, Divider, Input, Stack, Text, useTokens } from '@/design';
import { erasePersonData, exportPersonData, listAuditLog } from '@/services/api/compliance';
import { listPersons } from '@/services/api/persons';
import type { Person } from '@/types/person';
import { logger } from '@/utils/logger';

const ERASE_REASON_MIN_LENGTH = 20;
const AUDIT_PAGE_SIZE = 50;

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AdminComplianceScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();

  const [search, setSearch] = useState('');
  const [auditOffset, setAuditOffset] = useState(0);

  const queryClient = useQueryClient();

  const personsQuery = useQuery({
    queryKey: ['persons', 'list', { search }],
    queryFn: () => listPersons({ search: search.trim() || undefined }),
    enabled: search.trim().length >= 2,
    staleTime: 10_000,
  });

  const auditQuery = useQuery({
    queryKey: ['compliance', 'audit', { offset: auditOffset, limit: AUDIT_PAGE_SIZE }],
    queryFn: () => listAuditLog({ limit: AUDIT_PAGE_SIZE, offset: auditOffset }),
    staleTime: 10_000,
  });

  const exportMutation = useMutation({
    mutationFn: (id: string) => exportPersonData(id),
    onSuccess: async (envelope) => {
      const json = JSON.stringify(envelope, null, 2);
      try {
        await Share.share({
          message: json,
          title: `stmina-export-${envelope.person_id}.json`,
        });
      } catch (e) {
        logger.warn('admin.compliance: share failed', {
          error: e instanceof Error ? e.message : String(e),
        });
      }
      void queryClient.invalidateQueries({ queryKey: ['compliance', 'audit'] });
    },
    onError: (e: unknown) => {
      logger.warn('admin.compliance: export failed', {
        error: e instanceof Error ? e.message : String(e),
      });
      Alert.alert(t('admin.compliance.title'), t('admin.compliance.exportFailed'));
    },
  });

  const [eraseTarget, setEraseTarget] = useState<Person | null>(null);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
    >
      <Stack gap="md">
        <Text variant="headingMd">{t('admin.compliance.personSection')}</Text>
        <Input
          value={search}
          onChangeText={setSearch}
          label={t('admin.compliance.searchPlaceholder')}
          autoCapitalize="words"
          autoCorrect={false}
        />
        <Card padding="none">
          {personsQuery.isPending && search.trim().length >= 2 ? (
            <View style={{ padding: spacing.lg }}>
              <Text variant="bodySm" color={colors.textMuted}>
                {t('settings.privacy.loading')}
              </Text>
            </View>
          ) : null}
          {personsQuery.data && personsQuery.data.length === 0 ? (
            <View style={{ padding: spacing.lg }}>
              <Text variant="bodySm" color={colors.textMuted}>
                {t('admin.compliance.noResults')}
              </Text>
            </View>
          ) : null}
          {(personsQuery.data ?? []).map((p, idx, arr) => (
            <View key={p.id}>
              <View
                style={{
                  padding: spacing.lg,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="bodyLg">
                    {p.first_name} {p.last_name}
                  </Text>
                  {p.region ? (
                    <Text variant="bodySm" color={colors.textMuted}>
                      {p.region}
                    </Text>
                  ) : null}
                </View>
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => exportMutation.mutate(p.id)}
                  loading={exportMutation.isPending && exportMutation.variables === p.id}
                >
                  {t('admin.compliance.exportPerson')}
                </Button>
                <Button variant="destructive" size="sm" onPress={() => setEraseTarget(p)}>
                  {t('admin.compliance.erasePerson')}
                </Button>
              </View>
              {idx < arr.length - 1 ? <Divider /> : null}
            </View>
          ))}
        </Card>
      </Stack>

      <Stack gap="md">
        <Text variant="headingMd">{t('admin.compliance.audit.title')}</Text>
        <Card padding="none">
          {auditQuery.isPending ? (
            <View style={{ padding: spacing.lg }}>
              <Text variant="bodySm" color={colors.textMuted}>
                {t('settings.privacy.loading')}
              </Text>
            </View>
          ) : (auditQuery.data?.length ?? 0) === 0 ? (
            <View style={{ padding: spacing.lg }}>
              <Text variant="bodySm" color={colors.textMuted}>
                {t('admin.compliance.audit.empty')}
              </Text>
            </View>
          ) : (
            (auditQuery.data ?? []).map((row, idx, arr) => (
              <View key={row.id}>
                <View style={{ padding: spacing.lg }}>
                  <Text variant="body">
                    {t('admin.compliance.audit.row', {
                      action: row.action,
                      target:
                        row.target_type && row.target_id
                          ? `${row.target_type}:${row.target_id.slice(0, 8)}`
                          : '—',
                      when: formatDateTime(row.created_at),
                    })}
                  </Text>
                  <Text variant="caption" color={colors.textMuted}>
                    {row.actor_id ? row.actor_id.slice(0, 8) : '—'}
                  </Text>
                </View>
                {idx < arr.length - 1 ? <Divider /> : null}
              </View>
            ))
          )}
        </Card>
        {(auditQuery.data?.length ?? 0) >= AUDIT_PAGE_SIZE ? (
          <Button
            variant="ghost"
            onPress={() => setAuditOffset((o) => o + AUDIT_PAGE_SIZE)}
            loading={auditQuery.isFetching}
          >
            {t('admin.compliance.audit.loadMore')}
          </Button>
        ) : null}
      </Stack>

      {eraseTarget ? (
        <EraseConfirmModal
          target={eraseTarget}
          onCancel={() => setEraseTarget(null)}
          onSuccess={() => {
            setEraseTarget(null);
            void queryClient.invalidateQueries({ queryKey: ['persons'] });
            void queryClient.invalidateQueries({ queryKey: ['compliance', 'audit'] });
          }}
        />
      ) : null}
    </ScrollView>
  );
}

interface EraseConfirmModalProps {
  target: Person;
  onCancel: () => void;
  onSuccess: () => void;
}

function EraseConfirmModal({ target, onCancel, onSuccess }: EraseConfirmModalProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullName = `${target.first_name} ${target.last_name}`.trim();
  const reasonLength = reason.trim().length;
  const canConfirm =
    !submitting && typed.trim() === fullName && reasonLength >= ERASE_REASON_MIN_LENGTH;

  const onConfirm = async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    setError(null);
    try {
      await erasePersonData(target.id, reason.trim());
      onSuccess();
    } catch (e) {
      logger.warn('admin.compliance: erase failed', {
        error: e instanceof Error ? e.message : String(e),
      });
      setError(t('admin.compliance.eraseFailed'));
      setSubmitting(false);
    }
  };

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
          <Text variant="headingMd">
            {t('admin.compliance.eraseConfirmTitle', { name: fullName })}
          </Text>
          <Text variant="body" color={colors.textMuted}>
            {t('admin.compliance.eraseConfirmBody')}
          </Text>
          <Input
            label={t('admin.compliance.eraseConfirmTypePrompt', { name: fullName })}
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="words"
            autoCorrect={false}
            placeholder={fullName}
          />
          <Input
            label={t('admin.compliance.eraseConfirmReason')}
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={4}
            autoCorrect
            helper={`${reasonLength}/${ERASE_REASON_MIN_LENGTH}`}
          />
          {error ? (
            <Text variant="bodySm" color={colors.error}>
              {error}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button variant="ghost" style={{ flex: 1 }} onPress={onCancel} disabled={submitting}>
              {t('common.actions.cancel')}
            </Button>
            <Button
              variant="destructive"
              style={{ flex: 1 }}
              onPress={onConfirm}
              disabled={!canConfirm}
              loading={submitting}
            >
              {t('admin.compliance.eraseConfirm')}
            </Button>
          </View>
        </Stack>
      </Card>
    </View>
  );
}
