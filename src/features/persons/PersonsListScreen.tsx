/**
 * Persons list. Servants and admins see the same set of rows (RLS lets
 * the RPC return everything); only admins gain edit/reassign affordances
 * — added in a later phase.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  Input,
  LoadingSkeleton,
  Stack,
  Text,
  useTokens,
} from '@/design';
import { listPersons } from '@/services/api/persons';
import { getSyncEngine } from '@/services/sync/SyncEngine';
import type { Person, PersonPriority, PersonStatus, PersonsFilter } from '@/types/person';

const PRIORITY_VARIANT: Record<
  PersonPriority,
  'priorityHigh' | 'priorityMedium' | 'priorityLow' | 'priorityVeryLow'
> = {
  high: 'priorityHigh',
  medium: 'priorityMedium',
  low: 'priorityLow',
  very_low: 'priorityVeryLow',
};

const STATUS_VARIANT: Record<PersonStatus, 'success' | 'info' | 'warning' | 'neutral'> = {
  active: 'success',
  new: 'info',
  on_break: 'warning',
  inactive: 'neutral',
};

export default function PersonsListScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  const router = useRouter();
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const filter = useMemo<PersonsFilter>(
    () => (debouncedSearch ? { search: debouncedSearch } : {}),
    [debouncedSearch],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['persons', filter],
    queryFn: () => listPersons(filter),
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await getSyncEngine().runOnce();
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
        <Input
          label={t('persons.list.searchPlaceholder')}
          value={searchInput}
          onChangeText={setSearchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {isLoading ? (
        <Stack gap="sm" padding="lg">
          {Array.from({ length: 6 }, (_, i) => (
            <LoadingSkeleton key={i} height={64} radius="lg" />
          ))}
        </Stack>
      ) : isError ? (
        <EmptyState icon="alertCircle" title={t('persons.list.error')} />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState icon="users" title={t('persons.list.empty')} />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
          }
          renderItem={({ item }) => (
            <PersonRow person={item} onPress={() => router.push(`/persons/${item.id}`)} />
          )}
        />
      )}
    </View>
  );
}

interface PersonRowProps {
  person: Person;
  onPress: () => void;
}

function PersonRow({ person, onPress }: PersonRowProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${person.first_name} ${person.last_name}`}
      onPress={onPress}
    >
      <Card padding="md">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Avatar
            id={person.id}
            firstName={person.first_name}
            lastName={person.last_name}
            size="md"
          />
          <View style={{ flex: 1 }}>
            <Text variant="bodyLg" style={{ fontWeight: '600' }}>
              {person.first_name} {person.last_name}
            </Text>
            {person.region ? (
              <Text variant="bodySm" color={colors.textMuted}>
                {person.region}
              </Text>
            ) : null}
          </View>
          <View style={{ gap: spacing.xs, alignItems: 'flex-end' }}>
            <Badge variant={PRIORITY_VARIANT[person.priority]}>
              {t(`persons.priority.${person.priority}` as const)}
            </Badge>
            <Badge variant={STATUS_VARIANT[person.status]}>
              {t(`persons.status.${person.status}` as const)}
            </Badge>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
