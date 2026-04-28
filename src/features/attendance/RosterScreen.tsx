/**
 * Attendance roster — the actual check-in surface.
 *
 *   * Three queries fired in parallel: the event itself, the servant's
 *     My Group, and the existing attendance set for the event.
 *   * A separate query (`is_event_within_edit_window`) decides whether
 *     we render in edit mode or in read-only mode behind a banner.
 *   * Toggling a row updates a local pending-set via `rosterState`.
 *   * Save batches `markAttendance` (adds) + `unmarkAttendance` (removes)
 *     in parallel; on success we refetch attendance and clear pending.
 *
 * Search uses the dedicated `search_persons` RPC. Hits not in My Group
 * appear in a separate section so the servant can mark non-assigned
 * members without leaving the roster.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  FlatList,
  Pressable,
  RefreshControl,
  View,
  type ListRenderItem,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useLocalSearchParams } from 'expo-router';
import { Banner, FAB } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  Avatar,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  Input,
  LoadingSkeleton,
  Snackbar,
  Stack,
  Text,
  useTokens,
} from '@/design';
import {
  getEventAttendance,
  isEventWithinEditWindow,
  markAttendance,
  searchPersons,
  unmarkAttendance,
} from '@/services/api/attendance';
import { getAlertConfig } from '@/services/api/alertConfig';
import { getEvent } from '@/services/api/events';
import { listPersons } from '@/services/api/persons';
import { getSyncEngine } from '@/services/sync/SyncEngine';
import { useAuth } from '@/hooks/useAuth';
import type { PersonSearchHit } from '@/types/attendance';
import type { CalendarEvent } from '@/types/event';
import type { Person } from '@/types/person';

import { haptics } from '@/utils/haptics';

import {
  emptyRoster,
  isChecked,
  pendingCount,
  togglePerson,
  withRefreshedPresent,
  type RosterState,
} from './rosterState';

type Section =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'row'; key: string; row: RosterRow };

interface RosterRow {
  id: string;
  first_name: string;
  last_name: string;
  region: string | null;
}

function rowFromPerson(p: Person): RosterRow {
  return {
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    region: p.region,
  };
}

function rowFromHit(h: PersonSearchHit): RosterRow {
  return {
    id: h.id,
    first_name: h.first_name,
    last_name: h.last_name,
    region: h.region,
  };
}

function formatCutoff(eventStartIso: string): string {
  // Cutoff = day after start_at @ 03:00 Berlin. Format in Berlin so the
  // banner reads "the morning after at 03:00" regardless of the user's
  // device timezone — matches what the SQL function checks against.
  const start = new Date(eventStartIso);
  const cutoff = new Date(start.getTime());
  cutoff.setDate(cutoff.getDate() + 1);
  cutoff.setHours(3, 0, 0, 0);
  return cutoff.toLocaleString('en-GB', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function RosterScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { servant } = useAuth();
  const queryClient = useQueryClient();

  const [state, setState] = useState<RosterState>(() => emptyRoster());
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [snack, setSnack] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await getSyncEngine().runOnce();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['attendance', 'event-attendance', eventId] }),
        queryClient.invalidateQueries({ queryKey: ['attendance', 'my-group', servant?.id] }),
        queryClient.invalidateQueries({ queryKey: ['attendance', 'event', eventId] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [eventId, queryClient, servant?.id]);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // The picker fetches today's events; re-use that cache to find the
  // Look up the event by id directly so this works for past events
  // within the grace window (the picker now surfaces those too — see
  // `getCheckInEvents` and 022/023 migrations).
  const eventQuery = useQuery({
    queryKey: ['attendance', 'event', eventId],
    queryFn: () => getEvent(eventId),
    enabled: typeof eventId === 'string' && eventId.length > 0,
  });

  // Pull the admin grace window so the local edit-window check agrees
  // with the server's `is_event_within_edit_window`. Falls back to 3
  // (the migration default) if the call fails.
  const alertConfigQuery = useQuery({
    queryKey: ['alert-config'],
    queryFn: getAlertConfig,
    staleTime: 60_000,
  });
  const graceDays = alertConfigQuery.data?.grace_period_days ?? 3;

  const myGroupQuery = useQuery({
    queryKey: ['attendance', 'my-group', servant?.id],
    queryFn: () => listPersons({ assigned_servant: servant?.id }),
    enabled: typeof servant?.id === 'string',
  });

  const attendanceQuery = useQuery({
    queryKey: ['attendance', 'event-attendance', eventId],
    queryFn: () => getEventAttendance(eventId),
    enabled: typeof eventId === 'string' && eventId.length > 0,
  });

  const editWindowQuery = useQuery({
    queryKey: ['attendance', 'edit-window', eventId, graceDays],
    queryFn: () => isEventWithinEditWindow(eventId, graceDays),
    enabled: typeof eventId === 'string' && eventId.length > 0,
  });

  const searchQuery = useQuery({
    queryKey: ['attendance', 'search', debouncedSearch],
    queryFn: () => searchPersons(debouncedSearch),
    enabled: debouncedSearch.length > 0,
  });

  // Seed the pending-set state from the server-side present set whenever
  // attendance refetches succeed. We avoid clobbering pending changes
  // by only re-seeding when the present set actually differs.
  useEffect(() => {
    if (!attendanceQuery.data) return;
    const nextIds = attendanceQuery.data.map((r) => r.person_id);
    const nextSet = new Set(nextIds);
    setState((prev) => {
      const same =
        prev.present.size === nextSet.size && [...prev.present].every((id) => nextSet.has(id));
      if (same) return prev;
      return withRefreshedPresent(prev, nextIds);
    });
  }, [attendanceQuery.data]);

  const event: CalendarEvent | null | undefined = eventQuery.data;
  const myGroup = useMemo<RosterRow[]>(
    () => (myGroupQuery.data ?? []).map(rowFromPerson),
    [myGroupQuery.data],
  );
  const myGroupIds = useMemo(() => new Set(myGroup.map((r) => r.id)), [myGroup]);

  // While a search query is active, both sections are filtered by it:
  //   * My Group narrows to assigned persons whose first/last name
  //     matches (mirroring the server-side ILIKE logic).
  //   * "Find someone else" still shows non-group hits only — same
  //     person never appears twice on screen.
  // Empty query → My Group shows the full assigned list and the search
  // section shows the type-to-search hint.
  const matchesSearch = useCallback((row: RosterRow, q: string) => {
    const needle = q.toLowerCase();
    return (
      row.first_name.toLowerCase().includes(needle) || row.last_name.toLowerCase().includes(needle)
    );
  }, []);

  const filteredMyGroup = useMemo<RosterRow[]>(() => {
    if (debouncedSearch.length === 0) return myGroup;
    return myGroup.filter((row) => matchesSearch(row, debouncedSearch));
  }, [debouncedSearch, matchesSearch, myGroup]);

  const searchRows = useMemo<RosterRow[]>(() => {
    if (debouncedSearch.length === 0) return [];
    return (searchQuery.data ?? []).filter((hit) => !myGroupIds.has(hit.id)).map(rowFromHit);
  }, [searchQuery.data, debouncedSearch, myGroupIds]);

  const editable = editWindowQuery.data === true;

  const onToggle = useCallback(
    (id: string) => {
      if (!editable) return;
      haptics.light();
      setState((prev) => togglePerson(prev, id));
    },
    [editable],
  );

  const onSave = useCallback(async () => {
    if (!editable || saving) return;
    if (typeof eventId !== 'string') return;
    const adds = [...state.pendingAdds];
    const removes = [...state.pendingRemoves];
    if (adds.length === 0 && removes.length === 0) return;

    setSaving(true);
    try {
      await Promise.all([markAttendance(eventId, adds), unmarkAttendance(eventId, removes)]);
      // Refetch the canonical set and any cross-cutting cache that
      // depends on it. The state effect above will reseed pending sets.
      await queryClient.invalidateQueries({
        queryKey: ['attendance', 'event-attendance', eventId],
      });
      // Streak resets / alert resolutions ripple through the home view.
      await queryClient.invalidateQueries({ queryKey: ['servant-dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['follow-ups', 'pending'] });
      haptics.success();
      setSnack({ message: t('attendance.roster.successSaved'), tone: 'success' });
    } catch (e) {
      // Log the underlying error so a servant testing in Expo Go can
      // see the supabase-js payload in Metro — the user-facing copy
      // stays translated and stable.
      if (__DEV__) console.error('[attendance/save]', e);
      const message = (e as Error).message ?? '';
      const userMessage = /edit_window_closed/i.test(message)
        ? t('attendance.roster.errorEditWindowClosed')
        : t('attendance.roster.errorSave');
      // Refresh the edit-window status so the banner appears if that's
      // what changed under us — the pending state is preserved either way.
      await queryClient.invalidateQueries({ queryKey: ['attendance', 'edit-window', eventId] });
      haptics.error();
      setSnack({ message: userMessage, tone: 'error' });
    } finally {
      setSaving(false);
    }
  }, [editable, eventId, queryClient, saving, state.pendingAdds, state.pendingRemoves, t]);

  const sections = useMemo<Section[]>(() => {
    const out: Section[] = [];
    out.push({
      kind: 'header',
      key: 'h-mygroup',
      label: t('attendance.roster.myGroup'),
    });
    if (myGroup.length === 0) {
      // Render the empty hint inline as a non-tappable row so FlatList
      // still has a stable layout (no separate empty branch).
      out.push({
        kind: 'header',
        key: 'h-mygroup-empty',
        label: t('attendance.roster.myGroupEmpty'),
      });
    } else if (filteredMyGroup.length === 0) {
      // The servant has assigned persons but none match the active
      // search — show the same "no matches" affordance the search
      // section uses, so the section reads consistently.
      out.push({
        kind: 'header',
        key: 'h-mygroup-search-empty',
        label: t('attendance.roster.searchEmpty'),
      });
    } else {
      for (const row of filteredMyGroup) {
        out.push({ kind: 'row', key: `mg-${row.id}`, row });
      }
    }

    out.push({
      kind: 'header',
      key: 'h-search',
      label: t('attendance.roster.findSomeoneElse'),
    });
    if (debouncedSearch.length === 0) {
      out.push({
        kind: 'header',
        key: 'h-search-hint',
        label: t('attendance.roster.searchHint'),
      });
    } else if (searchQuery.isLoading) {
      // Spinner-style header label while the debounced query resolves.
      out.push({
        kind: 'header',
        key: 'h-search-loading',
        label: '…',
      });
    } else if (searchRows.length === 0) {
      out.push({
        kind: 'header',
        key: 'h-search-empty',
        label: t('attendance.roster.searchEmpty'),
      });
    } else {
      for (const row of searchRows) {
        out.push({ kind: 'row', key: `sr-${row.id}`, row });
      }
    }
    return out;
  }, [debouncedSearch, filteredMyGroup, myGroup.length, searchQuery.isLoading, searchRows, t]);

  const renderItem = useCallback<ListRenderItem<Section>>(
    ({ item }) => {
      if (item.kind === 'header') {
        return (
          <Text
            variant="label"
            color={colors.textMuted}
            style={{ marginTop: spacing.md, marginBottom: spacing.xs }}
          >
            {item.label}
          </Text>
        );
      }
      const checked = isChecked(state, item.row.id);
      return (
        <RosterRowView
          row={item.row}
          checked={checked}
          disabled={!editable}
          onPress={() => onToggle(item.row.id)}
        />
      );
    },
    [colors.textMuted, editable, onToggle, spacing.md, spacing.xs, state],
  );

  const isLoading =
    eventQuery.isLoading ||
    myGroupQuery.isLoading ||
    attendanceQuery.isLoading ||
    editWindowQuery.isLoading;

  const isError = eventQuery.isError || myGroupQuery.isError || attendanceQuery.isError;

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Stack gap="sm" padding="lg">
          {Array.from({ length: 6 }, (_, i) => (
            <LoadingSkeleton key={i} height={64} radius="lg" />
          ))}
        </Stack>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ErrorState
          title={t('attendance.roster.loadError')}
          retryLabel={t('common.actions.retry')}
          onRetry={() => {
            void eventQuery.refetch();
            void myGroupQuery.refetch();
            void attendanceQuery.refetch();
            void editWindowQuery.refetch();
          }}
        />
      </View>
    );
  }

  const count = pendingCount(state);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {!editable && event ? (
        <Banner visible icon="alert-circle">
          {t('attendance.roster.editWindowClosed')}
          {'\n'}
          {t('attendance.roster.editWindowCutoff', { cutoff: formatCutoff(event.start_at) })}
        </Banner>
      ) : null}

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Input
          label={t('attendance.roster.searchPlaceholder')}
          value={searchInput}
          onChangeText={setSearchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <FlatList
        data={sections}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.xs, paddingBottom: 96 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
      />

      {editable && count > 0 ? (
        <FAB
          accessibilityLabel={t('attendance.roster.save')}
          icon="content-save"
          label={t('attendance.roster.saveCount', { count })}
          onPress={() => void onSave()}
          loading={saving}
          style={{ position: 'absolute', right: spacing.lg, bottom: spacing.lg }}
        />
      ) : null}

      <Snackbar visible={snack !== null} onDismiss={() => setSnack(null)} duration={4000}>
        {snack?.message ?? ''}
      </Snackbar>
    </View>
  );
}

interface RosterRowViewProps {
  row: RosterRow;
  checked: boolean;
  disabled: boolean;
  onPress: () => void;
}

function RosterRowView({ row, checked, disabled, onPress }: RosterRowViewProps) {
  const { colors, spacing, radii } = useTokens();
  const fullName = `${row.first_name} ${row.last_name}`;
  const checkScale = useSharedValue(1);
  const animatedCheckStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      if (mounted) setReduceMotion(value);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const onPressWithBounce = () => {
    if (!reduceMotion) {
      // Tap bounce: dip → pop → settle. Mirrors the spec's
      // 0.95 → 1.05 → 1.0 sequence so the toggle feels acknowledged.
      checkScale.value = withSequence(
        withTiming(0.95, { duration: 60 }),
        withTiming(1.05, { duration: 90 }),
        withTiming(1, { duration: 90 }),
      );
    }
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={fullName}
      onPress={onPressWithBounce}
      disabled={disabled}
    >
      <Card padding="md" style={{ opacity: disabled ? 0.6 : 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Avatar id={row.id} firstName={row.first_name} lastName={row.last_name} size="md" />
          <View style={{ flex: 1 }}>
            <Text variant="bodyLg" style={{ fontWeight: '600' }}>
              {fullName}
            </Text>
            {row.region ? (
              <Text variant="bodySm" color={colors.textMuted}>
                {row.region}
              </Text>
            ) : null}
          </View>
          <Animated.View
            style={[
              {
                width: 28,
                height: 28,
                borderRadius: radii.full,
                borderWidth: 2,
                borderColor: checked ? colors.success : colors.border,
                backgroundColor: checked ? colors.success : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              },
              animatedCheckStyle,
            ]}
          >
            {checked ? <Icon name="check" size={18} color={colors.textInverse} /> : null}
          </Animated.View>
        </View>
      </Card>
    </Pressable>
  );
}
