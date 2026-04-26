/**
 * Person profile (read-only). Edit/reassign affordances arrive in a
 * later phase. The `comments` field is shown only when the RPC returns
 * a non-null value (caller is admin or assigned servant); otherwise we
 * surface a localized "comments hidden" banner.
 */
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Banner } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import {
  Avatar,
  Badge,
  Card,
  Divider,
  EmptyState,
  LoadingSkeleton,
  Stack,
  Text,
  useTokens,
} from '@/design';
import { useAuth } from '@/hooks/useAuth';
import { getPerson } from '@/services/api/persons';
import type { Person, PersonPriority, PersonStatus } from '@/types/person';

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

export default function PersonProfile() {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['person', id],
    queryFn: () => getPerson(id),
    enabled: typeof id === 'string' && id.length > 0,
  });

  if (isLoading) {
    return (
      <Stack padding="lg" gap="md">
        <LoadingSkeleton height={56} radius="full" width={56} />
        <LoadingSkeleton height={24} width="60%" />
        <LoadingSkeleton height={120} radius="lg" />
      </Stack>
    );
  }
  if (isError || !data) {
    return <EmptyState icon="alertCircle" title={t('persons.list.error')} />;
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Avatar id={data.id} firstName={data.first_name} lastName={data.last_name} size="lg" />
        <View style={{ flex: 1 }}>
          <Text variant="headingLg">
            {data.first_name} {data.last_name}
          </Text>
          {data.region ? (
            <Text variant="body" color={colors.textMuted}>
              {data.region}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs }}>
            <Badge variant={PRIORITY_VARIANT[data.priority]}>
              {t(`persons.priority.${data.priority}` as const)}
            </Badge>
            <Badge variant={STATUS_VARIANT[data.status]}>
              {t(`persons.status.${data.status}` as const)}
            </Badge>
          </View>
        </View>
      </View>

      <Card>
        <Stack gap="sm">
          <Field label={t('persons.profile.firstName')} value={data.first_name} />
          <Divider />
          <Field label={t('persons.profile.lastName')} value={data.last_name} />
          <Divider />
          <Field label={t('persons.profile.phone')} value={data.phone ?? '—'} />
          <Divider />
          <Field label={t('persons.profile.region')} value={data.region ?? '—'} />
          <Divider />
          <Field label={t('persons.profile.language')} value={languageLabel(data, t)} />
          <Divider />
          <Field
            label={t('persons.profile.priority')}
            value={t(`persons.priority.${data.priority}` as const)}
          />
          <Divider />
          <Field
            label={t('persons.profile.status')}
            value={t(`persons.status.${data.status}` as const)}
          />
          <Divider />
          <Field
            label={t('persons.profile.registeredAt')}
            value={new Date(data.registered_at).toLocaleDateString()}
          />
        </Stack>
      </Card>

      <CommentsSection person={data} />
    </ScrollView>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  const { colors } = useTokens();
  return (
    <Stack gap="xs">
      <Text variant="caption" color={colors.textMuted}>
        {label}
      </Text>
      <Text variant="body">{value}</Text>
    </Stack>
  );
}

function CommentsSection({ person }: { person: Person }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  const { servant } = useAuth();
  // Mirror the RPC's visibility rule client-side so we can distinguish
  // "you can't see comments" from "this person has no comments yet" —
  // the wire response is `null` in both cases.
  const canSeeComments = servant?.role === 'admin' || servant?.id === person.assigned_servant;

  if (!canSeeComments) {
    return (
      <View style={{ marginTop: spacing.sm }}>
        <Banner visible icon="lock">
          {t('persons.profile.commentsHidden')}
        </Banner>
      </View>
    );
  }

  return (
    <Card>
      <Stack gap="sm">
        <Text variant="label" color={colors.textMuted}>
          {t('persons.profile.comments')}
        </Text>
        <Text variant="body" color={person.comments ? colors.text : colors.textMuted}>
          {person.comments ?? t('persons.profile.commentsEmpty')}
        </Text>
      </Stack>
    </Card>
  );
}

function languageLabel(person: Person, t: ReturnType<typeof useTranslation>['t']): string {
  switch (person.language) {
    case 'en':
      return t('settings.language.english');
    case 'ar':
      return t('settings.language.arabic');
    case 'de':
      return t('settings.language.german');
    default:
      return person.language;
  }
}
