/**
 * Attendance event picker — lists today's events (via `getTodayEvents`)
 * and routes to the roster on tap. The "Counted" badge mirrors what
 * the admin counted-events screen shows so servants know which events
 * affect absence streaks.
 */
import { FlatList, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { Badge, Card, EmptyState, LoadingSkeleton, Stack, Text, useTokens } from '@/design';
import { getTodayEvents } from '@/services/api/events';
import type { CalendarEvent } from '@/types/event';

function formatRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const fmt = (d: Date) => d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${fmt(start)} – ${fmt(end)}`;
}

export default function AttendancePicker() {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  const router = useRouter();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['attendance', 'today-events'],
    queryFn: getTodayEvents,
  });

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
        <EmptyState icon="alertCircle" title={t('attendance.picker.loadError')} />
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
