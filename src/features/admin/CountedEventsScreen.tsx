/**
 * Admin Counted Events screen — three sections:
 *
 *   1. Last sync timestamp + outcome chip + "Resync now" button.
 *   2. Patterns CRUD (text input + list of existing patterns with
 *      delete buttons).
 *   3. Preview list of upcoming counted events in the next 14 days.
 *
 * All RPC calls go through `services/api/events.ts`. Pattern mutations
 * recompute `events.is_counted` server-side, so we just refetch the
 * preview after each save / delete.
 */
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  Snackbar,
  Spinner,
  Stack,
  Text,
  useTokens,
} from '@/design';
import {
  deleteCountedEventPattern,
  getLastSyncStatus,
  listCountedEventPatterns,
  listUpcomingCountedEvents,
  triggerCalendarSync,
  upsertCountedEventPattern,
} from '@/services/api/events';
import { getSyncEngine } from '@/services/sync/SyncEngine';
import type { CalendarEvent, CountedEventPattern, SyncLogRow } from '@/types/event';

function formatRelative(iso: string, t: TFunction): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return t('admin.countedEvents.justNow');
  if (minutes < 60) return t('admin.countedEvents.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('admin.countedEvents.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  return t('admin.countedEvents.daysAgo', { count: days });
}

function formatEventStart(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CountedEventsScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();

  const [lastSync, setLastSync] = useState<SyncLogRow | null>(null);
  const [patterns, setPatterns] = useState<CountedEventPattern[]>([]);
  const [upcoming, setUpcoming] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [resyncing, setResyncing] = useState(false);
  const [newPattern, setNewPattern] = useState('');
  const [savingPattern, setSavingPattern] = useState(false);
  const [snack, setSnack] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  const refresh = useCallback(async () => {
    const [sync, pats, ups] = await Promise.all([
      getLastSyncStatus(),
      listCountedEventPatterns(),
      listUpcomingCountedEvents(),
    ]);
    setLastSync(sync);
    setPatterns(pats);
    setUpcoming(ups);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await refresh();
      } catch (e) {
        if (!cancelled) setSnack({ message: (e as Error).message, tone: 'error' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const onResync = async () => {
    setResyncing(true);
    try {
      await triggerCalendarSync();
      // Give the Edge Function a moment, then refresh the status row
      // AND kick the local SyncEngine so the new events flow into the
      // SQLite mirror. Without the kick, the attendance picker keeps
      // showing the pre-resync events until the next AppState foreground
      // or app reload.
      setTimeout(() => {
        void refresh().catch(() => undefined);
        getSyncEngine()
          .runOnce({ pull: true })
          .catch(() => undefined);
      }, 1500);
      setSnack({ message: t('admin.countedEvents.resyncQueued'), tone: 'success' });
    } catch (e) {
      const message = (e as Error).message ?? '';
      const userMessage = /rate_limited/i.test(message)
        ? t('admin.countedEvents.errors.rateLimited')
        : t('admin.countedEvents.errors.resyncFailed');
      setSnack({ message: userMessage, tone: 'error' });
    } finally {
      setResyncing(false);
    }
  };

  const onAddPattern = async () => {
    const trimmed = newPattern.trim();
    if (trimmed === '') return;
    setSavingPattern(true);
    try {
      await upsertCountedEventPattern(trimmed);
      setNewPattern('');
      await refresh();
    } catch (e) {
      setSnack({ message: (e as Error).message, tone: 'error' });
    } finally {
      setSavingPattern(false);
    }
  };

  const onDeletePattern = async (id: string) => {
    try {
      await deleteCountedEventPattern(id);
      await refresh();
    } catch (e) {
      setSnack({ message: (e as Error).message, tone: 'error' });
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        {/* Section 1: last sync */}
        <Card padding="lg">
          <Stack gap="md">
            <Text variant="label" color={colors.textMuted}>
              {t('admin.countedEvents.lastSync')}
            </Text>
            {lastSync ? (
              <Stack gap="sm">
                <Text variant="bodyLg">{formatRelative(lastSync.started_at, t)}</Text>
                <SyncOutcomeBadge outcome={lastSync.outcome} t={t} />
                {lastSync.outcome === 'error' && lastSync.error ? (
                  <Text variant="bodySm" color={colors.error}>
                    {lastSync.error}
                  </Text>
                ) : null}
              </Stack>
            ) : (
              <Text variant="body" color={colors.textMuted}>
                {t('admin.countedEvents.neverSynced')}
              </Text>
            )}
            <Button onPress={onResync} disabled={resyncing} loading={resyncing}>
              {t('admin.countedEvents.resync')}
            </Button>
          </Stack>
        </Card>

        {/* Section 2: patterns CRUD */}
        <Card padding="lg">
          <Stack gap="md">
            <Text variant="label" color={colors.textMuted}>
              {t('admin.countedEvents.patterns.title')}
            </Text>

            <Stack gap="sm">
              <Input
                value={newPattern}
                onChangeText={setNewPattern}
                placeholder={t('admin.countedEvents.patterns.placeholder')}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={() => void onAddPattern()}
              />
              <Button
                variant="secondary"
                onPress={() => void onAddPattern()}
                disabled={newPattern.trim() === '' || savingPattern}
                loading={savingPattern}
              >
                {t('admin.countedEvents.patterns.add')}
              </Button>
            </Stack>

            {patterns.length === 0 ? (
              <Text variant="body" color={colors.textMuted}>
                {t('admin.countedEvents.patterns.empty')}
              </Text>
            ) : (
              <Stack gap="sm">
                {patterns.map((p) => (
                  <View
                    key={p.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: spacing.xs,
                    }}
                  >
                    <Text variant="bodyLg" style={{ flex: 1 }}>
                      {p.pattern}
                    </Text>
                    <IconButton
                      name="trash"
                      onPress={() => void onDeletePattern(p.id)}
                      accessibilityLabel={t('admin.countedEvents.patterns.removeA11y', {
                        pattern: p.pattern,
                      })}
                    />
                  </View>
                ))}
              </Stack>
            )}
          </Stack>
        </Card>

        {/* Section 3: preview */}
        <Card padding="lg">
          <Stack gap="md">
            <Text variant="label" color={colors.textMuted}>
              {t('admin.countedEvents.preview.title')}
            </Text>
            {upcoming.length === 0 ? (
              <EmptyState icon="calendar" title={t('admin.countedEvents.preview.empty')} />
            ) : (
              <Stack gap="sm">
                {upcoming.map((ev) => (
                  <View
                    key={ev.id}
                    style={{
                      paddingVertical: spacing.xs,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <Text variant="bodyLg">{ev.title}</Text>
                    <Text variant="bodySm" color={colors.textMuted}>
                      {formatEventStart(ev.start_at)}
                    </Text>
                  </View>
                ))}
              </Stack>
            )}
          </Stack>
        </Card>
      </ScrollView>

      <Snackbar visible={snack !== null} onDismiss={() => setSnack(null)} duration={4000}>
        {snack?.message ?? ''}
      </Snackbar>
    </View>
  );
}

function SyncOutcomeBadge({ outcome, t }: { outcome: SyncLogRow['outcome']; t: TFunction }) {
  if (outcome === 'success') {
    return <Badge variant="success">{t('admin.countedEvents.outcome.success')}</Badge>;
  }
  if (outcome === 'error') {
    return <Badge variant="error">{t('admin.countedEvents.outcome.error')}</Badge>;
  }
  return <Badge variant="info">{t('admin.countedEvents.outcome.running')}</Badge>;
}
