/**
 * Person profile.
 *
 * Affordances surfaced here:
 *   - "Edit" button (always visible) → opens `/persons/[id]/edit`. The
 *     edit screen mirrors field-level RPC permissions in its UI; the
 *     RPC enforces them server-side regardless.
 *   - "Upgrade to Full" button (Quick Add rows only, visible to admin
 *     or assigned servant) → opens edit screen with `?upgrade=true`.
 *   - "Remove member" button (admin-only) → opens RemoveMemberDialog
 *     (typed-confirmation soft delete). General-churn path; distinct
 *     from the GDPR hard-erasure flow.
 *
 * `comments` is shown only when the RPC returns a non-null value
 * (caller is admin or assigned servant); otherwise we surface a
 * localized "comments hidden" banner.
 */
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Banner } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  LoadingSkeleton,
  Snackbar,
  Stack,
  Text,
  useTokens,
} from '@/design';
import { useAuth } from '@/hooks/useAuth';
import { RemoveMemberDialog } from '@/features/persons/RemoveMemberDialog';
import { endBreak } from '@/services/api/onBreak';
import { getPerson, softDeletePerson } from '@/services/api/persons';
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id, openFollowUp } = useLocalSearchParams<{ id: string; openFollowUp?: string }>();
  const { servant } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['person', id],
    queryFn: () => getPerson(id),
    enabled: typeof id === 'string' && id.length > 0,
  });

  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [endingBreak, setEndingBreak] = useState(false);
  const [errorSnack, setErrorSnack] = useState<string | null>(null);

  // Auto-open the follow-up modal when arriving via an absence_alert
  // notification deep link (`?openFollowUp=true`). The forwarder runs
  // exactly once per mount even on re-renders.
  const followUpOpened = useRef(false);
  useEffect(() => {
    if (followUpOpened.current) return;
    if (typeof id !== 'string' || id.length === 0) return;
    if (openFollowUp !== 'true' && openFollowUp !== '1') return;
    followUpOpened.current = true;
    router.setParams({ openFollowUp: undefined });
    router.push(`/persons/${id}/follow-up`);
  }, [id, openFollowUp, router]);

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

  const isAdmin = servant?.role === 'admin';
  const isAssigned = servant?.id === data.assigned_servant;
  const showUpgrade = data.registration_type === 'quick_add' && (isAdmin || isAssigned);
  const fullName = `${data.first_name} ${data.last_name}`.trim();

  const onRemoveConfirm = async () => {
    setRemoving(true);
    try {
      await softDeletePerson(data.id);
      await queryClient.invalidateQueries({ queryKey: ['persons'] });
      await queryClient.invalidateQueries({ queryKey: ['person', data.id] });
      setConfirmRemove(false);
      router.replace('/persons');
    } catch {
      setErrorSnack(t('common.errors.generic'));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Avatar id={data.id} firstName={data.first_name} lastName={data.last_name} size="lg" />
        <View style={{ flex: 1 }}>
          <Text variant="headingLg">{fullName}</Text>
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

      <Stack gap="sm">
        <Button variant="primary" onPress={() => router.push(`/persons/${data.id}/edit`)}>
          {t('persons.edit.button')}
        </Button>
        {showUpgrade ? (
          <Button
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: `/persons/${data.id}/edit`,
                params: { upgrade: 'true' },
              })
            }
          >
            {t('persons.upgrade.button')}
          </Button>
        ) : null}
        <Button variant="secondary" onPress={() => router.push(`/persons/${data.id}/follow-up`)}>
          {t('persons.followUp.button')}
        </Button>
        {isAdmin || isAssigned ? (
          data.status === 'on_break' ? (
            <Button
              variant="ghost"
              loading={endingBreak}
              disabled={endingBreak}
              onPress={async () => {
                setEndingBreak(true);
                try {
                  await endBreak(data.id);
                  await queryClient.invalidateQueries({ queryKey: ['person', data.id] });
                } catch (e) {
                  setErrorSnack((e as Error).message);
                } finally {
                  setEndingBreak(false);
                }
              }}
            >
              {t('persons.onBreak.endBreak')}
            </Button>
          ) : (
            <Button variant="ghost" onPress={() => router.push(`/persons/${data.id}/on-break`)}>
              {t('persons.onBreak.button')}
            </Button>
          )
        ) : null}
      </Stack>

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

      {isAdmin ? (
        <Button variant="destructive" onPress={() => setConfirmRemove(true)}>
          {t('persons.delete.button')}
        </Button>
      ) : null}

      <RemoveMemberDialog
        visible={confirmRemove}
        fullName={fullName}
        busy={removing}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={onRemoveConfirm}
      />

      <Snackbar visible={errorSnack !== null} onDismiss={() => setErrorSnack(null)} duration={4000}>
        {errorSnack ?? ''}
      </Snackbar>
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
