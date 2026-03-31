import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../src/theme/colors';
import { fontFamily, fontSize, lineHeight } from '../../src/theme/typography';
import { spacing } from '../../src/theme/spacing';
import { radius } from '../../src/theme/radius';
import { useAuthStore } from '../../src/stores/authStore';
import { usePersons } from '../../src/hooks/usePersons';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const { profile } = useAuthStore();
  const isAdmin = profile?.role === 'admin';

  const { data: persons, isLoading } = usePersons();

  // Compute summary stats from persons
  const myGroup = persons?.filter(
    (p) => p.assigned_servant_id === profile?.id
  );
  const recentNewcomers = persons
    ?.filter((p) => p.registration_type === 'quick_add' || p.status === 'new')
    .slice(0, 5) ?? [];
  const totalMembers = persons?.length ?? 0;
  const activeMembers = persons?.filter((p) => p.status === 'active').length ?? 0;
  const newThisMonth = persons?.filter((p) => {
    const registeredAt = new Date(p.registered_at);
    const now = new Date();
    return (
      registeredAt.getMonth() === now.getMonth() &&
      registeredAt.getFullYear() === now.getFullYear()
    );
  }).length ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.greeting}>
          {getGreeting()},{' '}
          {profile ? profile.firstName : t('tabs.home')}
        </Text>
        <Text style={styles.subtitle}>{t('auth.tagline')}</Text>

        {/* Quick action row */}
        <View style={styles.quickActions}>
          <Pressable
            style={({ pressed }) => [
              styles.quickAction,
              pressed && styles.quickActionPressed,
            ]}
            onPress={() => router.push('/(tabs)/people/quick-add')}
          >
            <Ionicons name="flash" size={24} color={colors.primary} />
            <Text style={styles.quickActionLabel}>{t('people.quickAdd')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.quickAction,
              pressed && styles.quickActionPressed,
            ]}
            onPress={() => router.push('/(tabs)/checkin')}
          >
            <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
            <Text style={styles.quickActionLabel}>{t('tabs.checkin')}</Text>
          </Pressable>
        </View>

        {/* My Group card */}
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => router.push('/(tabs)/people')}
        >
          <View style={styles.cardRow}>
            <View style={styles.cardIcon}>
              <Ionicons name="people" size={20} color={colors.primary} />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{t('home.myGroup')}</Text>
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.inkTertiary} />
              ) : (
                <Text style={styles.cardValue}>
                  {myGroup?.length ?? 0} {t('home.members')}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.inkTertiary} />
          </View>
        </Pressable>

        {/* Pending Follow-ups card (placeholder — wired in Phase 4) */}
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => router.push('/(tabs)/more/follow-ups')}
        >
          <View style={styles.cardRow}>
            <View style={styles.cardIcon}>
              <Ionicons name="clipboard" size={20} color={colors.gold} />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{t('home.pendingFollowUps')}</Text>
              <Text style={styles.cardValue}>— {t('home.availablePhase4')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.inkTertiary} />
          </View>
        </Pressable>

        {/* Recent Newcomers card */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={styles.cardIcon}>
              <Ionicons name="person-add" size={20} color={colors.present} />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{t('home.recentNewcomers')}</Text>
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.inkTertiary} />
              ) : (
                <Text style={styles.cardValue}>
                  {newThisMonth} {t('home.thisMonth')}
                </Text>
              )}
            </View>
          </View>

          {recentNewcomers.length > 0 && (
            <View style={styles.newcomerList}>
              {recentNewcomers.map((p) => (
                <Pressable
                  key={p.id}
                  style={({ pressed }) => [
                    styles.newcomerRow,
                    pressed && styles.newcomerRowPressed,
                  ]}
                  onPress={() => router.push(`/(tabs)/people/${p.id}`)}
                >
                  <Text style={styles.newcomerName}>
                    {p.first_name} {p.last_name}
                  </Text>
                  <Text style={styles.newcomerDate}>
                    {new Date(p.registered_at).toLocaleDateString()}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Admin stats (admin only) */}
        {isAdmin && (
          <>
            <Text style={styles.sectionTitle}>{t('home.adminOverview')}</Text>
            <View style={styles.statsGrid}>
              <StatTile
                label={t('home.totalMembers')}
                value={isLoading ? '…' : String(totalMembers)}
                icon="people-outline"
              />
              <StatTile
                label={t('home.activeMembers')}
                value={isLoading ? '…' : String(activeMembers)}
                icon="checkmark-circle-outline"
              />
              <StatTile
                label={t('home.newcomersThisMonth')}
                value={isLoading ? '…' : String(newThisMonth)}
                icon="person-add-outline"
              />
              <StatTile
                label={t('home.atRisk')}
                value="—"
                icon="warning-outline"
                color={colors.atRisk}
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

interface StatTileProps {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color?: string;
}

function StatTile({ label, value, icon, color = colors.primary }: StatTileProps) {
  return (
    <View style={tileStyles.tile}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[tileStyles.value, { color }]}>{value}</Text>
      <Text style={tileStyles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing[5],
    paddingBottom: spacing[10],
  },
  greeting: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.h1,
    lineHeight: lineHeight.h1,
    color: colors.ink,
    marginBottom: spacing[1],
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    lineHeight: lineHeight.body,
    color: colors.inkSecondary,
    marginBottom: spacing[5],
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  quickAction: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing[4],
    alignItems: 'center',
    gap: spacing[2],
  },
  quickActionPressed: {
    backgroundColor: colors.sandDark,
  },
  quickActionLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.bodySmall,
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  cardPressed: {
    backgroundColor: colors.sandDark,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.body,
    lineHeight: lineHeight.body,
    color: colors.ink,
  },
  cardValue: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.bodySmall,
    lineHeight: lineHeight.bodySmall,
    color: colors.inkSecondary,
    marginTop: 2,
  },
  newcomerList: {
    marginTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  newcomerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  newcomerRowPressed: {
    backgroundColor: colors.sandDark,
  },
  newcomerName: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.bodySmall,
    color: colors.ink,
  },
  newcomerDate: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.caption,
    color: colors.inkTertiary,
  },
  sectionTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.h3,
    lineHeight: lineHeight.h3,
    color: colors.ink,
    marginTop: spacing[2],
    marginBottom: spacing[3],
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
});

const tileStyles = StyleSheet.create({
  tile: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[4],
    alignItems: 'center',
    gap: spacing[1],
  },
  value: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.h2,
    lineHeight: lineHeight.h2,
  },
  label: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.caption,
    color: colors.inkSecondary,
    textAlign: 'center',
  },
});
