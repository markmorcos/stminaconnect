import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../src/theme/colors';
import { fontFamily, fontSize, lineHeight } from '../../../src/theme/typography';
import { spacing } from '../../../src/theme/spacing';
import { radius } from '../../../src/theme/radius';
import { SearchBar } from '../../../src/components/SearchBar';
import { FilterChips } from '../../../src/components/FilterChips';
import { AttendanceChip } from '../../../src/components/AttendanceChip';
import { usePersons } from '../../../src/hooks/usePersons';
import { useAuthStore } from '../../../src/stores/authStore';
import { Person } from '../../../src/types';

type FilterKey = 'all' | 'my_group' | 'new' | 'active' | 'inactive';

const PRIORITY_COLORS: Record<string, string> = {
  high: colors.absent,
  medium: colors.atRisk,
  low: colors.present,
  very_low: colors.inkTertiary,
};

export default function PeopleScreen() {
  const { t } = useTranslation();
  const { profile } = useAuthStore();
  const { data: persons, isLoading, error, refetch } = usePersons();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [fabOpen, setFabOpen] = useState(false);

  const filterChips = [
    { key: 'all', label: t('people.filterAll') },
    { key: 'my_group', label: t('people.filterMyGroup') },
    { key: 'new', label: t('people.status.new') },
    { key: 'active', label: t('people.status.active') },
    { key: 'inactive', label: t('people.status.inactive') },
  ];

  const filtered = useMemo(() => {
    if (!persons) return [];
    let list = persons;

    // Filter by status / group
    if (filter === 'my_group' && profile?.id) {
      list = list.filter((p) => p.assigned_servant_id === profile.id);
    } else if (filter === 'new') {
      list = list.filter((p) => p.status === 'new');
    } else if (filter === 'active') {
      list = list.filter((p) => p.status === 'active');
    } else if (filter === 'inactive') {
      list = list.filter((p) => p.status === 'inactive');
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.first_name.toLowerCase().includes(q) ||
          p.last_name.toLowerCase().includes(q) ||
          p.phone.includes(q)
      );
    }

    return list;
  }, [persons, filter, search, profile?.id]);

  function handlePersonPress(person: Person) {
    router.push(`/(tabs)/people/${person.id}`);
  }

  function handleQuickAdd() {
    setFabOpen(false);
    router.push('/(tabs)/people/quick-add');
  }

  function handleRegister() {
    setFabOpen(false);
    router.push('/(tabs)/people/register');
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{t('common.error')}</Text>
          <Pressable onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder={t('people.searchMembers')}
        />
      </View>

      {/* Filter chips */}
      <FilterChips
        chips={filterChips}
        selected={filter}
        onSelect={(key) => setFilter(key as FilterKey)}
      />

      {/* Member list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          filtered.length === 0 && styles.listEmpty,
        ]}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.personRow,
              pressed && styles.personRowPressed,
            ]}
            onPress={() => handlePersonPress(item)}
          >
            {/* Priority dot */}
            <View
              style={[
                styles.priorityDot,
                {
                  backgroundColor: item.priority
                    ? PRIORITY_COLORS[item.priority]
                    : colors.inkTertiary,
                },
              ]}
            />
            <View style={styles.personInfo}>
              <Text style={styles.personName}>
                {item.first_name} {item.last_name}
              </Text>
              {item.region ? (
                <Text style={styles.personRegion}>{item.region}</Text>
              ) : null}
            </View>
            <AttendanceChip status={item.status as 'present' | 'absent' | 'at_risk'} />
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.inkTertiary}
              style={styles.chevron}
            />
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={colors.inkTertiary} />
            <Text style={styles.emptyTitle}>
              {search ? t('people.noResults') : t('people.noMembers')}
            </Text>
            {!search && (
              <Text style={styles.emptySubtitle}>{t('people.emptyHint')}</Text>
            )}
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* FAB */}
      {fabOpen && (
        <Pressable
          style={styles.fabBackdrop}
          onPress={() => setFabOpen(false)}
        />
      )}
      {fabOpen && (
        <View style={styles.fabMenu}>
          <Pressable style={styles.fabMenuItem} onPress={handleRegister}>
            <Ionicons name="person-add" size={20} color={colors.white} />
            <Text style={styles.fabMenuText}>{t('people.register')}</Text>
          </Pressable>
          <View style={styles.fabMenuDivider} />
          <Pressable style={styles.fabMenuItem} onPress={handleQuickAdd}>
            <Ionicons name="flash" size={20} color={colors.white} />
            <Text style={styles.fabMenuText}>{t('people.quickAdd')}</Text>
          </Pressable>
        </View>
      )}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => setFabOpen((v) => !v)}
        accessibilityLabel={t('people.addNew')}
      >
        <Ionicons
          name={fabOpen ? 'close' : 'add'}
          size={28}
          color={colors.white}
        />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[5],
  },
  searchContainer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[1],
  },
  listContent: {
    paddingBottom: spacing[12] + spacing[5],
  },
  listEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    minHeight: 60,
  },
  personRowPressed: {
    backgroundColor: colors.sandDark,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    marginRight: spacing[3],
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.body,
    lineHeight: lineHeight.body,
    color: colors.ink,
  },
  personRegion: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.bodySmall,
    lineHeight: lineHeight.bodySmall,
    color: colors.inkSecondary,
    marginTop: 2,
  },
  chevron: {
    marginLeft: spacing[2],
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing[5],
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[8],
  },
  emptyTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.h3,
    color: colors.inkSecondary,
    marginTop: spacing[4],
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.inkTertiary,
    marginTop: spacing[2],
    textAlign: 'center',
  },
  errorText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.absent,
    marginBottom: spacing[3],
  },
  retryButton: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
  },
  retryText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.body,
    color: colors.primary,
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: spacing[6],
    right: spacing[5],
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  fabPressed: {
    backgroundColor: colors.primaryLight,
  },
  fabBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  fabMenu: {
    position: 'absolute',
    bottom: spacing[6] + 64,
    right: spacing[5],
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  fabMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    gap: spacing[3],
  },
  fabMenuText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.body,
    color: colors.white,
  },
  fabMenuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
});
