/**
 * Sync Issues — surfaces queue rows the engine has parked at
 * `status='needs_attention'` (a 4xx return from the server). Each row
 * shows the op type, payload summary, the parsed `last_error`, and a
 * "Discard" button. There's intentionally no Retry: most 4xx errors
 * (foreign-key violation, member soft-deleted, validation) are not
 * meaningfully retryable from a stale local payload.
 */
import { useCallback, useState } from 'react';
import { Appbar } from 'react-native-paper';
import { FlatList, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  Stack,
  Text,
  useTokens,
} from '@/design';
import { discardOp, listNeedsAttention, type QueueOp } from '@/services/db/repositories/queueRepo';

export default function SyncIssuesScreen() {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTokens();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['sync-issues'],
    queryFn: listNeedsAttention,
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const onDiscard = useCallback(
    async (id: number) => {
      await discardOp(id);
      await queryClient.invalidateQueries({ queryKey: ['sync-issues'] });
    },
    [queryClient],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Appbar.Header style={{ backgroundColor: colors.surface }}>
        <Appbar.BackAction
          color={colors.text}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
        <Appbar.Content
          title={t('syncIssues.title')}
          titleStyle={{ color: colors.text, fontFamily: 'Inter-SemiBold', fontSize: 18 }}
        />
      </Appbar.Header>

      {isLoading ? (
        <Stack gap="sm" padding="lg">
          {Array.from({ length: 3 }, (_, i) => (
            <LoadingSkeleton key={i} height={96} radius="lg" />
          ))}
        </Stack>
      ) : isError ? (
        <ErrorState
          title={t('syncIssues.loadError')}
          retryLabel={t('common.actions.retry')}
          onRetry={() => void refetch()}
        />
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon="check" title={t('syncIssues.empty')} body={t('syncIssues.emptyHint')} />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(op) => String(op.id)}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
          }
          renderItem={({ item }) => (
            <IssueRow
              op={item}
              language={i18n.language}
              onDiscard={() => void onDiscard(item.id)}
            />
          )}
        />
      )}
    </View>
  );
}

function IssueRow({
  op,
  language,
  onDiscard,
}: {
  op: QueueOp;
  language: string;
  onDiscard: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  const opLabel = t(`syncIssues.opType.${op.op_type}`);
  return (
    <Card padding="md">
      <Stack gap="sm">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text variant="bodyLg" style={{ flex: 1, fontWeight: '600' }}>
            {opLabel}
          </Text>
          <Text variant="caption" color={colors.textMuted}>
            {new Date(op.created_at).toLocaleString(language)}
          </Text>
        </View>
        {op.last_error ? (
          <Text variant="bodySm" color={colors.error}>
            {op.last_error}
          </Text>
        ) : null}
        <Button variant="secondary" size="sm" onPress={onDiscard}>
          {t('syncIssues.discard')}
        </Button>
      </Stack>
    </Card>
  );
}
