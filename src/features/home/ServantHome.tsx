/**
 * Non-admin servant home screen.
 *
 * Four fixed sections in a scroll view (per spec):
 *   1. Quick actions row — Quick Add, Check In, Register full.
 *   2. My Group — assigned persons sorted by streak status priority
 *      (Red → Yellow → Green → On Break) with last-seen / streak detail.
 *   3. Pending follow-ups — count badge, top 3 rows, "View all" link.
 *   4. Recent newcomers (30 days, all servants) — name + relative date
 *      + registration-type chip.
 *
 * Each section owns a TanStack Query so a single slow/erroring section
 * doesn't block the others; pull-to-refresh refetches everything in
 * parallel. The follow-up preview reuses the existing
 * `['follow-ups', 'pending']` query key so opening the dedicated screen
 * is warm-cache.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Banner } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useQuery } from '@tanstack/react-query';

import {
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  Icon,
  LoadingSkeleton,
  Snackbar,
  Stack,
  Text,
  useTokens,
  type IconName,
} from '@/design';
import { useAuth } from '@/hooks/useAuth';
import { getMyGroup, getPendingFollowupsCount, getRecentNewcomers } from '@/services/api/dashboard';
import { listPendingFollowUps, type PendingRow } from '@/services/api/followUps';
import { missingSupabaseEnvVars } from '@/services/api/supabase';
import { streakStatus, type StreakStatus } from '@/features/servantDashboard/streakStatus';
import type { ServantMyGroupRow, ServantRecentNewcomerRow } from '@/types/dashboard';
import { formatDate, formatNumber } from '@/utils/formatNumber';

const SHOW_DEV_TOOLS = __DEV__ || process.env.EXPO_PUBLIC_SHOW_DEV_TOOLS === 'true';
// design.md decision 8: 2 minutes — more frequent than the admin dashboard
// because this screen drives the servant's daily pastoral action.
const STALE_TIME = 2 * 60 * 1000;
const FOLLOWUP_PREVIEW_LIMIT = 3;
const NEWCOMER_PREVIEW_LIMIT = 5;

const STATUS_PRIORITY: Record<StreakStatus, number> = {
  red: 0,
  yellow: 1,
  green: 2,
  break: 3,
};

export function ServantHome() {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTokens();
  const router = useRouter();
  const { servant } = useAuth();
  const params = useLocalSearchParams<{ welcome?: string }>();
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const missingUrl = missingSupabaseEnvVars.includes('EXPO_PUBLIC_SUPABASE_URL');
  const greeting = servant?.display_name?.trim() || servant?.email || '';

  const myGroup = useQuery({
    queryKey: ['servant-dashboard', 'my-group'],
    queryFn: getMyGroup,
    staleTime: STALE_TIME,
  });
  const pendingCount = useQuery({
    queryKey: ['servant-dashboard', 'pending-count'],
    queryFn: getPendingFollowupsCount,
    staleTime: STALE_TIME,
  });
  // Reuse the existing follow-ups screen query key so opening the
  // dedicated screen is warm-cache.
  const pendingPreview = useQuery({
    queryKey: ['follow-ups', 'pending'],
    queryFn: () => listPendingFollowUps(),
    staleTime: STALE_TIME,
  });
  const newcomers = useQuery({
    queryKey: ['servant-dashboard', 'recent-newcomers'],
    queryFn: () => getRecentNewcomers(30),
    staleTime: STALE_TIME,
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([
        myGroup.refetch(),
        pendingCount.refetch(),
        pendingPreview.refetch(),
        newcomers.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [myGroup, pendingCount, pendingPreview, newcomers]);

  useEffect(() => {
    // Quick Add navigates back here with `?welcome=<first>` set; mirror
    // it into local state so we can clear the route param immediately
    // (otherwise the snackbar would re-appear on every re-render and
    // back-navigation).
    if (typeof params.welcome === 'string' && params.welcome.length > 0) {
      setWelcomeName(params.welcome);
      router.setParams({ welcome: undefined });
    }
  }, [params.welcome, router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {missingUrl ? (
        <Banner visible icon="alert-circle">
          {t('home.supabaseMissing')}
        </Banner>
      ) : null}

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
      >
        <Pressable
          onLongPress={() => {
            if (SHOW_DEV_TOOLS) router.push('/dev/showcase');
          }}
          delayLongPress={600}
        >
          {greeting ? (
            <Text variant="bodyLg" color={colors.textMuted}>
              {t('home.signedInAs', { name: greeting })}
            </Text>
          ) : null}
        </Pressable>

        <QuickActionsRow router={router} />

        <MyGroupSection
          data={myGroup.data}
          isLoading={myGroup.isLoading}
          isError={myGroup.isError}
          onRetry={() => void myGroup.refetch()}
          language={i18n.language}
          onPressRow={(personId) => router.push(`/persons/${personId}`)}
        />

        <PendingFollowupsCard
          count={pendingCount.data ?? 0}
          previewRows={pendingPreview.data ?? []}
          isLoading={pendingCount.isLoading || pendingPreview.isLoading}
          isError={pendingCount.isError || pendingPreview.isError}
          onRetry={() => {
            void pendingCount.refetch();
            void pendingPreview.refetch();
          }}
          language={i18n.language}
          onPressRow={(personId) => router.push(`/persons/${personId}`)}
          onPressViewAll={() => router.push('/follow-ups')}
        />

        <RecentNewcomersSection
          data={newcomers.data}
          isLoading={newcomers.isLoading}
          isError={newcomers.isError}
          onRetry={() => void newcomers.refetch()}
          language={i18n.language}
          onPressRow={(personId) => router.push(`/persons/${personId}`)}
        />
      </ScrollView>

      <Snackbar
        visible={welcomeName !== null}
        onDismiss={() => setWelcomeName(null)}
        duration={4000}
      >
        {welcomeName ? t('registration.quickAdd.successWelcome', { firstName: welcomeName }) : ''}
      </Snackbar>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Quick actions row
// ---------------------------------------------------------------------------

function QuickActionsRow({ router }: { router: ReturnType<typeof useRouter> }) {
  const { t } = useTranslation();
  const { spacing } = useTokens();
  const actions: { key: string; label: string; icon: IconName; href: Href }[] = [
    { key: 'check-in', label: t('home.checkIn'), icon: 'check', href: '/attendance' },
    {
      key: 'quick-add',
      label: t('home.quickAdd'),
      icon: 'userPlus',
      href: '/registration/quick-add',
    },
    {
      key: 'register-full',
      label: t('home.registerFull'),
      icon: 'user',
      href: '/registration/full',
    },
  ];
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      {actions.map((a) => (
        <QuickActionTile
          key={a.key}
          label={a.label}
          icon={a.icon}
          onPress={() => router.push(a.href)}
        />
      ))}
    </View>
  );
}

function QuickActionTile({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
}) {
  const { colors, spacing } = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.85 : 1 }]}
    >
      <Card padding="md" style={{ alignItems: 'center', gap: spacing.xs, minHeight: 72 }}>
        <Icon name={icon} color={colors.primary} size={24} />
        <Text variant="caption" style={{ textAlign: 'center', fontWeight: '600' }}>
          {label}
        </Text>
      </Card>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// My Group
// ---------------------------------------------------------------------------

interface MyGroupRow extends ServantMyGroupRow {
  bucket: StreakStatus;
}

function sortMyGroup(rows: ServantMyGroupRow[]): MyGroupRow[] {
  const enriched: MyGroupRow[] = rows.map((r) => ({
    ...r,
    bucket: streakStatus(r.streak, r.threshold, r.status, r.paused_until),
  }));
  enriched.sort((a, b) => {
    const pa = STATUS_PRIORITY[a.bucket];
    const pb = STATUS_PRIORITY[b.bucket];
    if (pa !== pb) return pa - pb;
    // Inside Red / Yellow: streak descending. Inside Green / Break: alpha.
    if (a.bucket === 'red' || a.bucket === 'yellow') {
      if (a.streak !== b.streak) return b.streak - a.streak;
    }
    return alphaCompare(a, b);
  });
  return enriched;
}

function alphaCompare(a: { first_name: string; last_name: string }, b: typeof a): number {
  const cmp = a.first_name.localeCompare(b.first_name);
  if (cmp !== 0) return cmp;
  return a.last_name.localeCompare(b.last_name);
}

function MyGroupSection({
  data,
  isLoading,
  isError,
  onRetry,
  language,
  onPressRow,
}: {
  data: ServantMyGroupRow[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  language: string;
  onPressRow: (personId: string) => void;
}) {
  const { t } = useTranslation();
  const sorted = useMemo(() => (data ? sortMyGroup(data) : []), [data]);

  if (isError) {
    return (
      <SectionShell title={t('home.servant.sections.myGroup')}>
        <SectionError onRetry={onRetry} />
      </SectionShell>
    );
  }

  if (isLoading || !data) {
    return (
      <SectionShell title={t('home.servant.sections.myGroup')}>
        <Stack gap="sm">
          {Array.from({ length: 3 }, (_, i) => (
            <LoadingSkeleton key={i} height={64} radius="lg" />
          ))}
        </Stack>
      </SectionShell>
    );
  }

  if (sorted.length === 0) {
    return (
      <SectionShell title={t('home.servant.sections.myGroup')}>
        <EmptyState icon="check" title={t('home.servant.empty.myGroup')} />
      </SectionShell>
    );
  }

  return (
    <SectionShell title={t('home.servant.sections.myGroup')}>
      <Card padding="none">
        {sorted.map((row, idx) => (
          <View key={row.person_id}>
            <MyGroupRowView
              row={row}
              language={language}
              onPress={() => onPressRow(row.person_id)}
            />
            {idx === sorted.length - 1 ? null : <Divider />}
          </View>
        ))}
      </Card>
    </SectionShell>
  );
}

function MyGroupRowView({
  row,
  language,
  onPress,
}: {
  row: MyGroupRow;
  language: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  const detail = describeMyGroupRow(row, language, t);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
    >
      <View
        style={{
          padding: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        }}
      >
        <StatusDot bucket={row.bucket} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyLg" style={{ fontWeight: '600' }}>
            {row.first_name} {row.last_name}
          </Text>
          {row.region ? (
            <Text variant="bodySm" color={colors.textMuted}>
              {row.region}
            </Text>
          ) : null}
          <Text variant="bodySm" color={colors.textMuted}>
            {detail}
          </Text>
        </View>
        {row.bucket === 'break' ? (
          <Badge variant="neutral">{t('home.servant.status.break')}</Badge>
        ) : null}
      </View>
    </Pressable>
  );
}

function describeMyGroupRow(row: MyGroupRow, language: string, t: TFunction): string {
  if (row.bucket === 'break') {
    if (row.paused_until && row.paused_until !== '9999-12-31') {
      return t('home.servant.onBreakUntil', {
        date: formatDate(`${row.paused_until}T00:00:00Z`, language, { dateStyle: 'medium' }),
      });
    }
    return t('home.servant.onBreakOpen');
  }
  if (row.bucket === 'red' || row.bucket === 'yellow') {
    return t('home.servant.missesLabel', { count: row.streak });
  }
  return formatLastSeen(row.last_attendance_at, language, t);
}

function formatLastSeen(lastAttendanceAt: string | null, language: string, t: TFunction): string {
  if (lastAttendanceAt == null) return t('home.servant.lastSeen.never');
  const days = wholeDaysSince(lastAttendanceAt);
  if (days <= 0) return t('home.servant.lastSeen.today');
  if (days === 1) return t('home.servant.lastSeen.yesterday');
  return t('home.servant.lastSeen.daysAgo', { count: days });
}

function wholeDaysSince(iso: string | Date): number {
  const then = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(then.getTime())) return 0;
  const ms = Date.now() - then.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function StatusDot({ bucket }: { bucket: StreakStatus }) {
  const { colors } = useTokens();
  const palette: Record<StreakStatus, string> = {
    green: colors.success,
    yellow: colors.warning,
    red: colors.error,
    break: colors.border,
  };
  return (
    <View
      accessibilityElementsHidden
      style={{
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: palette[bucket],
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Pending follow-ups card
// ---------------------------------------------------------------------------

function PendingFollowupsCard({
  count,
  previewRows,
  isLoading,
  isError,
  onRetry,
  language,
  onPressRow,
  onPressViewAll,
}: {
  count: number;
  previewRows: PendingRow[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  language: string;
  onPressRow: (personId: string) => void;
  onPressViewAll: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();

  const preview = useMemo(
    () =>
      previewRows
        .filter((r) => r.section === 'needs_follow_up')
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .slice(0, FOLLOWUP_PREVIEW_LIMIT),
    [previewRows],
  );

  if (isError) {
    return (
      <SectionShell title={t('home.servant.sections.pendingFollowups')}>
        <SectionError onRetry={onRetry} />
      </SectionShell>
    );
  }

  if (isLoading) {
    return (
      <SectionShell title={t('home.servant.sections.pendingFollowups')}>
        <LoadingSkeleton height={120} radius="lg" />
      </SectionShell>
    );
  }

  return (
    <SectionShell title={t('home.servant.sections.pendingFollowups')}>
      <Card padding="md">
        <Stack gap="sm">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Badge variant={count > 0 ? 'error' : 'neutral'}>{formatNumber(count, language)}</Badge>
            <Text variant="bodyLg" style={{ fontWeight: '600' }}>
              {count > 0 ? t('followUps.needsFollowUpBadge') : t('home.servant.empty.followups')}
            </Text>
          </View>

          {preview.length > 0 ? (
            <Stack gap="xs">
              {preview.map((row) => (
                <Pressable
                  key={row.alert_id ?? row.person_id}
                  accessibilityRole="button"
                  onPress={() => onPressRow(row.person_id)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      paddingVertical: spacing.xs,
                    }}
                  >
                    <Text variant="body" style={{ flex: 1, fontWeight: '500' }}>
                      {row.person_first} {row.person_last}
                    </Text>
                    {row.alert_streak != null ? (
                      <Text variant="caption" color={colors.error}>
                        {t('home.servant.missesLabel', { count: row.alert_streak })}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </Stack>
          ) : null}

          {count > 0 ? (
            <Button variant="secondary" size="sm" onPress={onPressViewAll}>
              {t('home.servant.viewAll')}
            </Button>
          ) : null}
        </Stack>
      </Card>
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// Recent newcomers
// ---------------------------------------------------------------------------

function RecentNewcomersSection({
  data,
  isLoading,
  isError,
  onRetry,
  language,
  onPressRow,
}: {
  data: ServantRecentNewcomerRow[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  language: string;
  onPressRow: (personId: string) => void;
}) {
  const { t } = useTranslation();
  const visible = useMemo(() => (data ?? []).slice(0, NEWCOMER_PREVIEW_LIMIT), [data]);

  if (isError) {
    return (
      <SectionShell title={t('home.servant.sections.recentNewcomers')}>
        <SectionError onRetry={onRetry} />
      </SectionShell>
    );
  }

  if (isLoading || !data) {
    return (
      <SectionShell title={t('home.servant.sections.recentNewcomers')}>
        <Stack gap="sm">
          {Array.from({ length: 2 }, (_, i) => (
            <LoadingSkeleton key={i} height={56} radius="lg" />
          ))}
        </Stack>
      </SectionShell>
    );
  }

  if (visible.length === 0) {
    return (
      <SectionShell title={t('home.servant.sections.recentNewcomers')}>
        <EmptyState icon="userPlus" title={t('home.servant.empty.newcomers')} />
      </SectionShell>
    );
  }

  return (
    <SectionShell title={t('home.servant.sections.recentNewcomers')}>
      <Card padding="none">
        {visible.map((row, idx) => (
          <View key={row.person_id}>
            <NewcomerRowView
              row={row}
              language={language}
              onPress={() => onPressRow(row.person_id)}
            />
            {idx === visible.length - 1 ? null : <Divider />}
          </View>
        ))}
      </Card>
    </SectionShell>
  );
}

function NewcomerRowView({
  row,
  language,
  onPress,
}: {
  row: ServantRecentNewcomerRow;
  language: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  const days = wholeDaysSince(row.registered_at);
  const relative =
    days <= 0
      ? t('home.servant.registeredAgo.today')
      : days === 1
        ? t('home.servant.registeredAgo.yesterday')
        : t('home.servant.registeredAgo.daysAgo', { count: days });

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
    >
      <View
        style={{
          padding: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text variant="bodyLg" style={{ fontWeight: '600' }}>
            {row.first_name} {row.last_name}
          </Text>
          <Text variant="bodySm" color={colors.textMuted}>
            {relative}
          </Text>
        </View>
        <Badge variant="neutral">
          {t(`home.servant.registrationType.${row.registration_type}`)}
        </Badge>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Shared section primitives
// ---------------------------------------------------------------------------

function SectionShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Stack gap="sm">
      <Text variant="headingMd">{title}</Text>
      {children}
    </Stack>
  );
}

function SectionError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <Card padding="md">
      <Stack gap="sm" align="center">
        <Text variant="body">{t('home.servant.loadError')}</Text>
        <Button variant="secondary" onPress={onRetry}>
          {t('home.servant.retry')}
        </Button>
      </Stack>
    </Card>
  );
}
