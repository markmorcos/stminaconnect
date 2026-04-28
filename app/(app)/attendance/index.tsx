/**
 * Attendance event picker — lists today's events plus any from the
 * configured backfill grace window so servants can mark attendance
 * for recent services they didn't get to in time. The window mirrors
 * `alert_config.grace_period_days` so the picker stays in lock-step
 * with the absence-detection streak walk.
 *
 * The "Counted" badge mirrors what the admin counted-events screen
 * shows so servants know which events affect absence streaks.
 */
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  Stack,
  Text,
  useTokens,
} from '@/design';
import { getAlertConfig } from '@/services/api/alertConfig';
import { getCheckInEvents } from '@/services/api/events';
import { getSyncEngine } from '@/services/sync/SyncEngine';
import type { CalendarEvent } from '@/types/event';

const DEFAULT_GRACE_DAYS = 3;

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const range = `${time(start)} – ${time(end)}`;
  if (isSameDay(start, new Date())) return range;
  const date = start.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return `${date} · ${range}`;
}

export default function AttendancePicker() {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  const router = useRouter();

  // Fetch the admin alert config first so we know how far back to look.
  // Servants are typically online when picking events; if the config
  // call fails (offline, RLS), we fall back to a 3-day window — matches
  // the migration default and is safe (worst case: shows a couple of
  // extra past events the servant can't actually mark).
  const alertConfigQuery = useQuery({
    queryKey: ['alert-config'],
    queryFn: getAlertConfig,
    staleTime: 60_000,
  });
  const graceDays = alertConfigQuery.data?.grace_period_days ?? DEFAULT_GRACE_DAYS;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['attendance', 'check-in-events', graceDays],
    queryFn: () => getCheckInEvents(graceDays),
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await getSyncEngine().runOnce();
      await alertConfigQuery.refetch();
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [alertConfigQuery, refetch]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Stack gap="sm" padding="lg">
          {Array.from({ length: 4 }, (_, i) => (
            <LoadingSkeleton key={i} height={84} radius="lg" />
          ))}
        </Stack>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ErrorState
          title={t('attendance.picker.loadError')}
          retryLabel={t('common.actions.retry')}
          onRetry={() => void refetch()}
        />
      </View>
    );
  }

  const events = data ?? [];

  if (events.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <EmptyState
          icon="calendar"
          title={t('attendance.picker.empty')}
          body={t('attendance.picker.emptyHint')}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
        renderItem={({ item }) => (
          <EventTile event={item} onPress={() => router.push(`/attendance/${item.id}`)} />
        )}
      />
    </View>
  );
}

function EventTile({ event, onPress }: { event: CalendarEvent; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={event.title} onPress={onPress}>
      <Card padding="md">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text variant="bodyLg" style={{ fontWeight: '600' }}>
              {event.title}
            </Text>
            <Text variant="bodySm" color={colors.textMuted}>
              {formatRange(event.start_at, event.end_at)}
            </Text>
          </View>
          {event.is_counted ? (
            <Badge variant="success">{t('attendance.picker.countedBadge')}</Badge>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}
