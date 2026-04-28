/**
 * Admin dashboard — five independently-fetched sections rendered in
 * order: overview cards, attendance trend (LineChart), at-risk list
 * grouped by servant, newcomer funnel, region breakdown (BarChart).
 *
 * Each section owns a TanStack Query so a slow/erroring section never
 * blocks the others. Pull-to-refresh invalidates all five queries via
 * `refetch()` on each result.
 */
import { useCallback, useMemo, useState } from 'react';
import { Dimensions, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { LineChart } from 'react-native-chart-kit';

import {
  Card,
  Divider,
  EmptyState,
  ErrorState,
  Icon,
  LoadingSkeleton,
  Stack,
  Text,
  useTokens,
  type IconName,
} from '@/design';
import {
  fetchDashboardAtRisk,
  fetchDashboardAttendanceTrend,
  fetchDashboardNewcomerFunnel,
  fetchDashboardOverview,
  fetchDashboardRegionBreakdown,
} from '@/services/api/dashboard';
import type {
  DashboardAtRiskRow,
  DashboardAttendanceTrendPoint,
  DashboardRegionRow,
} from '@/types/dashboard';
import { formatDateShort, formatNumber, formatPercent } from '@/utils/formatNumber';

const STALE_TIME = 5 * 60 * 1000; // 5 minutes (per design.md decision 3)

export function AdminDashboard() {
  const { i18n } = useTranslation();
  const { colors, spacing } = useTokens();
  const router = useRouter();

  const overview = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: fetchDashboardOverview,
    staleTime: STALE_TIME,
  });
  const trend = useQuery({
    queryKey: ['dashboard', 'trend'],
    queryFn: () => fetchDashboardAttendanceTrend(12),
    staleTime: STALE_TIME,
  });
  const atRisk = useQuery({
    queryKey: ['dashboard', 'at-risk'],
    queryFn: fetchDashboardAtRisk,
    staleTime: STALE_TIME,
  });
  const funnel = useQuery({
    queryKey: ['dashboard', 'funnel'],
    queryFn: () => fetchDashboardNewcomerFunnel(90),
    staleTime: STALE_TIME,
  });
  const regions = useQuery({
    queryKey: ['dashboard', 'regions'],
    queryFn: () => fetchDashboardRegionBreakdown(8),
    staleTime: STALE_TIME,
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([
        overview.refetch(),
        trend.refetch(),
        atRisk.refetch(),
        funnel.refetch(),
        regions.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [overview, trend, atRisk, funnel, regions]);

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
      style={{ backgroundColor: colors.background }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
    >
      <QuickActionsRow router={router} />
      <OverviewSection
        data={overview.data}
        isLoading={overview.isLoading}
        isError={overview.isError}
        onRetry={() => void overview.refetch()}
        language={i18n.language}
      />
      <TrendSection
        data={trend.data}
        isLoading={trend.isLoading}
        isError={trend.isError}
        onRetry={() => void trend.refetch()}
        language={i18n.language}
      />
      <AtRiskSection
        data={atRisk.data}
        isLoading={atRisk.isLoading}
        isError={atRisk.isError}
        onRetry={() => void atRisk.refetch()}
      />
      <FunnelSection
        data={funnel.data}
        isLoading={funnel.isLoading}
        isError={funnel.isError}
        onRetry={() => void funnel.refetch()}
        language={i18n.language}
      />
      <RegionsSection
        data={regions.data}
        isLoading={regions.isLoading}
        isError={regions.isError}
        onRetry={() => void regions.refetch()}
        language={i18n.language}
      />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Quick actions row — admins still need to check in / quick add / register.
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
// Section: overview cards
// ---------------------------------------------------------------------------

function OverviewSection({
  data,
  isLoading,
  isError,
  onRetry,
  language,
}: {
  data: ReturnType<typeof useQuery<unknown>>['data'] extends infer T ? T : never;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  language: string;
}) {
  const { t } = useTranslation();
  const { spacing } = useTokens();
  if (isError) return <SectionError onRetry={onRetry} />;
  if (isLoading || !data) {
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {Array.from({ length: 4 }, (_, i) => (
          <LoadingSkeleton key={i} height={88} radius="lg" style={{ flexBasis: '48%' }} />
        ))}
      </View>
    );
  }
  const o = data as {
    totalMembers: number;
    activeLast30: number;
    newThisMonth: number;
    avgAttendance4w: number;
  };
  const cards: { key: string; label: string; value: string }[] = [
    {
      key: 'total',
      label: t('admin.dashboard.cards.totalMembers'),
      value: formatNumber(o.totalMembers, language),
    },
    {
      key: 'active',
      label: t('admin.dashboard.cards.activeLast30'),
      value: formatNumber(o.activeLast30, language),
    },
    {
      key: 'new',
      label: t('admin.dashboard.cards.newThisMonth'),
      value: formatNumber(o.newThisMonth, language),
    },
    {
      key: 'avg',
      label: t('admin.dashboard.cards.avgAttendance4w'),
      value: formatNumber(o.avgAttendance4w, language, { maximumFractionDigits: 1 }),
    },
  ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {cards.map((c) => (
        <OverviewCard key={c.key} label={c.label} value={c.value} />
      ))}
    </View>
  );
}

function OverviewCard({ label, value }: { label: string; value: string }) {
  const { colors, spacing } = useTokens();
  return (
    <Card padding="md" style={{ flexBasis: '48%', flexGrow: 1, minHeight: 88 }}>
      <Stack gap="xs" justify="center" style={{ flex: 1, padding: spacing.xs }}>
        <Text variant="caption" color={colors.textMuted}>
          {label}
        </Text>
        <Text variant="displayMd" style={{ fontWeight: '700' }}>
          {value}
        </Text>
      </Stack>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Section: attendance trend (line chart)
// ---------------------------------------------------------------------------

function TrendSection({
  data,
  isLoading,
  isError,
  onRetry,
  language,
}: {
  data: DashboardAttendanceTrendPoint[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  language: string;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  if (isError) return <SectionError onRetry={onRetry} />;
  if (isLoading || !data) return <LoadingSkeleton height={220} radius="lg" />;
  if (data.length === 0) {
    return (
      <SectionShell title={t('admin.dashboard.trend.title')}>
        <EmptyState icon="calendar" title={t('admin.dashboard.trend.empty')} />
      </SectionShell>
    );
  }
  const latest = data[data.length - 1];
  const labels = data.map((p) => formatDateShort(p.start_at, language));
  const values = data.map((p) => p.attendee_count);
  const screenWidth = Dimensions.get('window').width;

  return (
    <SectionShell title={t('admin.dashboard.trend.title')}>
      <Stack gap="xs">
        <Text variant="caption" color={colors.textMuted}>
          {t('admin.dashboard.trend.latest', {
            value: formatNumber(latest.attendee_count, language),
            date: formatDateShort(latest.start_at, language),
          })}
        </Text>
        <LineChart
          data={{ labels, datasets: [{ data: values }] }}
          width={screenWidth - spacing.lg * 2}
          height={200}
          chartConfig={chartConfig(colors)}
          bezier
          withInnerLines={false}
          withOuterLines={false}
          fromZero
          style={{ marginVertical: spacing.sm, borderRadius: 12 }}
        />
      </Stack>
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// Section: at-risk list grouped by servant
// ---------------------------------------------------------------------------

function AtRiskSection({
  data,
  isLoading,
  isError,
  onRetry,
}: {
  data: DashboardAtRiskRow[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  const router = useRouter();

  const groups = useMemo(() => {
    const m = new Map<string, { name: string; rows: DashboardAtRiskRow[] }>();
    for (const r of data ?? []) {
      const g = m.get(r.servant_id) ?? { name: r.servant_name, rows: [] };
      g.rows.push(r);
      m.set(r.servant_id, g);
    }
    return Array.from(m.entries()).map(([id, g]) => ({ id, ...g }));
  }, [data]);

  if (isError) return <SectionError onRetry={onRetry} />;

  return (
    <SectionShell title={t('admin.dashboard.atRisk.title')}>
      {isLoading || !data ? (
        <Stack gap="sm">
          {Array.from({ length: 3 }, (_, i) => (
            <LoadingSkeleton key={i} height={56} radius="md" />
          ))}
        </Stack>
      ) : groups.length === 0 ? (
        <EmptyState icon="check" title={t('admin.dashboard.atRisk.empty')} />
      ) : (
        <Stack gap="md">
          {groups.map((g) => (
            <Stack key={g.id} gap="xs">
              <Text variant="label" color={colors.textMuted}>
                {g.name}
              </Text>
              <Card padding="none">
                {g.rows.map((row, idx) => (
                  <View key={row.person_id}>
                    <View
                      style={{
                        padding: spacing.md,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.md,
                      }}
                      onTouchEnd={() => router.push(`/persons/${row.person_id}`)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyLg" style={{ fontWeight: '600' }}>
                          {row.person_name}
                        </Text>
                        {row.last_event_title ? (
                          <Text variant="bodySm" color={colors.textMuted}>
                            {row.last_event_title}
                          </Text>
                        ) : null}
                      </View>
                      <Text variant="headingSm" color={colors.error}>
                        {t('admin.dashboard.atRisk.streak', { count: row.streak })}
                      </Text>
                    </View>
                    {idx === g.rows.length - 1 ? null : <Divider />}
                  </View>
                ))}
              </Card>
            </Stack>
          ))}
        </Stack>
      )}
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// Section: newcomer funnel
// ---------------------------------------------------------------------------

function FunnelSection({
  data,
  isLoading,
  isError,
  onRetry,
  language,
}: {
  data: { quickAdd: number; upgraded: number; active: number } | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  language: string;
}) {
  const { t } = useTranslation();
  const { colors } = useTokens();
  if (isError) return <SectionError onRetry={onRetry} />;

  return (
    <SectionShell title={t('admin.dashboard.funnel.title')}>
      {isLoading || !data ? (
        <LoadingSkeleton height={140} radius="lg" />
      ) : data.quickAdd === 0 ? (
        <EmptyState icon="info" title={t('admin.dashboard.funnel.empty')} />
      ) : (
        <Stack gap="sm">
          <FunnelBar
            label={t('admin.dashboard.funnel.quickAdd')}
            value={data.quickAdd}
            ratio={1}
            color={colors.primary}
            language={language}
          />
          <FunnelBar
            label={t('admin.dashboard.funnel.upgraded')}
            value={data.upgraded}
            ratio={data.quickAdd > 0 ? data.upgraded / data.quickAdd : 0}
            color={colors.secondary}
            language={language}
            showPercent
          />
          <FunnelBar
            label={t('admin.dashboard.funnel.active')}
            value={data.active}
            ratio={data.upgraded > 0 ? data.active / data.upgraded : 0}
            color={colors.success}
            language={language}
            showPercent
          />
        </Stack>
      )}
    </SectionShell>
  );
}

function FunnelBar({
  label,
  value,
  ratio,
  color,
  language,
  showPercent,
}: {
  label: string;
  value: number;
  ratio: number;
  color: string;
  language: string;
  showPercent?: boolean;
}) {
  const { colors, spacing } = useTokens();
  const widthPercent = Math.max(4, Math.min(100, Math.round(ratio * 100)));
  return (
    <Stack gap="xs">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="bodySm">{label}</Text>
        <Text variant="bodySm" color={colors.textMuted}>
          {formatNumber(value, language)}
          {showPercent ? ` · ${formatPercent(ratio, language)}` : ''}
        </Text>
      </View>
      <View
        style={{
          height: 12,
          backgroundColor: colors.border,
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${widthPercent}%`,
            backgroundColor: color,
            paddingRight: spacing.xs,
          }}
        />
      </View>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Section: region breakdown
// ---------------------------------------------------------------------------

function RegionsSection({
  data,
  isLoading,
  isError,
  onRetry,
  language,
}: {
  data: DashboardRegionRow[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  language: string;
}) {
  const { t } = useTranslation();
  const { colors } = useTokens();
  if (isError) return <SectionError onRetry={onRetry} />;
  if (isLoading || !data) return <LoadingSkeleton height={220} radius="lg" />;
  if (data.length === 0) {
    return (
      <SectionShell title={t('admin.dashboard.regions.title')}>
        <EmptyState icon="info" title={t('admin.dashboard.regions.empty')} />
      </SectionShell>
    );
  }
  // Horizontal bars rather than chart-kit BarChart: with 8+ regions
  // the vertical labels collide and the chart truncates names. Names
  // here are admin-entered free text (e.g. "outside Munich") that
  // routinely exceed the available x-axis tick width.
  const max = Math.max(...data.map((r) => r.member_count), 1);
  return (
    <SectionShell title={t('admin.dashboard.regions.title')}>
      <Stack gap="sm">
        {data.map((r) => (
          <FunnelBar
            key={r.region}
            label={r.region === 'Other' ? t('admin.dashboard.regions.other') : r.region}
            value={r.member_count}
            ratio={r.member_count / max}
            color={colors.accent}
            language={language}
          />
        ))}
      </Stack>
    </SectionShell>
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
    <ErrorState
      title={t('admin.dashboard.error')}
      retryLabel={t('admin.dashboard.retry')}
      onRetry={onRetry}
    />
  );
}

function chartConfig(colors: ReturnType<typeof useTokens>['colors']) {
  return {
    backgroundColor: colors.surface,
    backgroundGradientFrom: colors.surface,
    backgroundGradientTo: colors.surface,
    decimalPlaces: 0,
    color: (opacity = 1) => withAlpha(colors.primary, opacity),
    labelColor: (opacity = 1) => withAlpha(colors.text, opacity),
    propsForBackgroundLines: { stroke: colors.border },
    propsForDots: {
      r: '3',
      strokeWidth: '2',
      stroke: colors.primary,
    },
  };
}

function withAlpha(hex: string, opacity: number): string {
  // Best-effort: chart-kit expects an `rgba(...)` string. For brand
  // tokens we always have hex; convert here rather than complicating
  // the token schema with rgba variants.
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
