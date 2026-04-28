/**
 * Pending follow-ups screen — three sections:
 *
 *   1. Needs follow-up — unresolved absence_alerts with no follow-up.
 *   2. Snoozed → returning today/tomorrow — your snoozed follow-ups
 *      whose `snooze_until <= today + 1`.
 *   3. Recently logged — last 20 follow-ups by you in the past 14 days.
 *
 * Tapping a "Needs follow-up" row opens the follow-up modal pre-targeted
 * at that person. Other rows navigate to the person's profile.
 */
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  Stack,
  Text,
  useTokens,
} from '@/design';
import {
  listPendingFollowUps,
  type PendingRow,
  type PendingSection,
} from '@/services/api/followUps';

interface SectionRow {
  kind: 'header';
  key: string;
  label: string;
}
interface ItemRow {
  kind: 'row';
  key: string;
  row: PendingRow;
}
type ListRow = SectionRow | ItemRow;

const SECTION_ORDER: PendingSection[] = ['needs_follow_up', 'snoozed_returning', 'recent'];

export function PendingFollowUpsScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  const router = useRouter();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['follow-ups', 'pending'],
    queryFn: () => listPendingFollowUps(),
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

  const rows = useMemo<ListRow[]>(() => {
    const grouped = new Map<PendingSection, PendingRow[]>();
    for (const r of data ?? []) {
      const arr = grouped.get(r.section) ?? [];
      arr.push(r);
      grouped.set(r.section, arr);
    }
    const out: ListRow[] = [];
    for (const section of SECTION_ORDER) {
      const items = grouped.get(section) ?? [];
      if (items.length === 0) continue;
      // Latest first within every section. Postgres doesn't guarantee
      // ordering across UNION ALL, and we want stable "newest at top".
      items.sort((a, b) =>
        a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0,
      );
      out.push({
        kind: 'header',
        key: `header:${section}`,
        label: t(`followUps.sections.${section}`),
      });
      for (const r of items) {
        out.push({
          kind: 'row',
          key: `${section}:${r.follow_up_id ?? r.alert_id ?? r.person_id}`,
          row: r,
        });
      }
    }
    return out;
  }, [data, t]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {isLoading ? (
        <Stack gap="sm" padding="lg">
          {Array.from({ length: 5 }, (_, i) => (
            <LoadingSkeleton key={i} height={64} radius="lg" />
          ))}
        </Stack>
      ) : isError ? (
        <ErrorState
          title={t('followUps.loadError')}
          retryLabel={t('common.actions.retry')}
          onRetry={() => void refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState icon="check" title={t('followUps.empty')} body={t('followUps.emptyHint')} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.key}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
          }
          renderItem={({ item }) => {
            if (item.kind === 'header') {
              return (
                <Text variant="label" color={colors.textMuted} style={{ marginTop: spacing.md }}>
                  {item.label}
                </Text>
              );
            }
            return (
              <PendingTile
                row={item.row}
                onPress={() => {
                  if (item.row.section === 'needs_follow_up') {
                    router.push(`/persons/${item.row.person_id}/follow-up`);
                  } else {
                    router.push(`/persons/${item.row.person_id}`);
                  }
                }}
              />
            );
          }}
        />
      )}
    </View>
  );
}

function PendingTile({ row, onPress }: { row: PendingRow; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  const fullName = `${row.person_first} ${row.person_last}`.trim();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={fullName} onPress={onPress}>
      <Card padding="md">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Avatar
            id={row.person_id}
            firstName={row.person_first}
            lastName={row.person_last}
            size="md"
          />
          <View style={{ flex: 1 }}>
            <Text variant="bodyLg" style={{ fontWeight: '600' }}>
              {fullName}
            </Text>
            <Text variant="bodySm" color={colors.textMuted}>
              {row.section === 'needs_follow_up' && row.alert_streak != null
                ? t('followUps.alertSummary', { count: row.alert_streak })
                : null}
              {row.section === 'snoozed_returning' && row.snooze_until
                ? t('followUps.snoozedUntil', { date: row.snooze_until })
                : null}
              {row.section === 'recent' && row.action ? t(`followUps.action.${row.action}`) : null}
            </Text>
          </View>
          {row.section === 'needs_follow_up' ? (
            <Badge variant="warning">{t('followUps.needsFollowUpBadge')}</Badge>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}
