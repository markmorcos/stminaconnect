import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../src/theme/colors';
import { fontFamily, fontSize, lineHeight } from '../../../src/theme/typography';
import { spacing } from '../../../src/theme/spacing';
import { radius } from '../../../src/theme/radius';
import { AttendanceChip } from '../../../src/components/AttendanceChip';
import { Button } from '../../../src/components/Button';
import { usePerson, useDeletePerson, useUpdatePerson } from '../../../src/hooks/usePersons';
import { useServant } from '../../../src/hooks/useServants';
import { useAuthStore } from '../../../src/stores/authStore';
import { formatPhoneDisplay } from '../../../src/utils/phone';
import { Priority } from '../../../src/types';

const PRIORITY_COLORS: Record<Priority, string> = {
  high: colors.absent,
  medium: colors.atRisk,
  low: colors.present,
  very_low: colors.inkTertiary,
};

const STATUS_CHIP_MAP: Record<string, 'present' | 'absent' | 'at_risk'> = {
  active: 'present',
  inactive: 'absent',
  new: 'at_risk',
};

export default function PersonProfileScreen() {
  const { t } = useTranslation();
  const { personId } = useLocalSearchParams<{ personId: string }>();
  const { profile } = useAuthStore();

  const { data: person, isLoading, error } = usePerson(personId ?? '');
  const { data: assignedServant } = useServant(
    person?.assigned_servant_id ?? ''
  );
  const deletePerson = useDeletePerson();
  const updatePerson = useUpdatePerson();

  const isAdmin = profile?.role === 'admin';
  const isAssigned = profile?.id === person?.assigned_servant_id;
  const canEdit = isAdmin || isAssigned;
  const canSeeComments = isAdmin || isAssigned;

  function handleCall() {
    if (person?.phone) {
      Linking.openURL(`tel:${person.phone}`);
    }
  }

  function handleEdit() {
    router.push({
      pathname: '/(tabs)/people/register',
      params: { personId },
    });
  }

  function handleDelete() {
    Alert.alert(
      t('people.deleteConfirm'),
      t('people.deleteConfirmMsg', {
        name: `${person?.first_name} ${person?.last_name}`,
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePerson.mutateAsync(personId ?? '');
              router.back();
            } catch {
              Alert.alert(t('common.error'), t('common.error'));
            }
          },
        },
      ]
    );
  }

  async function handleTogglePause() {
    if (!person) return;
    const isPaused =
      person.paused_until && new Date(person.paused_until) > new Date();

    if (isPaused) {
      await updatePerson.mutateAsync({
        id: personId ?? '',
        input: { paused_until: null },
      });
    } else {
      // Pause for 4 weeks
      const resumeDate = new Date();
      resumeDate.setDate(resumeDate.getDate() + 28);
      await updatePerson.mutateAsync({
        id: personId ?? '',
        input: { paused_until: resumeDate.toISOString() },
      });
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !person) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{t('common.error')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isPaused =
    person.paused_until && new Date(person.paused_until) > new Date();
  const fullName = `${person.first_name} ${person.last_name}`;

  return (
    <>
      <Stack.Screen
        options={{
          title: fullName,
          headerRight: canEdit
            ? () => (
                <Pressable onPress={handleEdit} hitSlop={8}>
                  <Ionicons name="create-outline" size={22} color={colors.white} />
                </Pressable>
              )
            : undefined,
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* Header card */}
          <View style={styles.headerCard}>
            <View style={styles.headerRow}>
              <Text style={styles.name}>{fullName}</Text>
              <AttendanceChip status={STATUS_CHIP_MAP[person.status] ?? 'at_risk'} />
            </View>
            {person.priority && (
              <View style={styles.priorityRow}>
                <View
                  style={[
                    styles.priorityDot,
                    { backgroundColor: PRIORITY_COLORS[person.priority] },
                  ]}
                />
                <Text style={styles.priorityLabel}>
                  {t(`people.priority_labels.${person.priority}`)}
                </Text>
                {isPaused && (
                  <View style={styles.pausedBadge}>
                    <Text style={styles.pausedBadgeText}>
                      {t('people.onBreak')}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Info section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('people.info')}</Text>

            <InfoRow
              icon="call-outline"
              label={t('people.phone')}
              value={formatPhoneDisplay(person.phone)}
              onPress={handleCall}
            />
            {person.region && (
              <InfoRow
                icon="location-outline"
                label={t('people.region')}
                value={person.region}
              />
            )}
            <InfoRow
              icon="language-outline"
              label={t('people.language')}
              value={person.language.toUpperCase()}
            />
            <InfoRow
              icon="person-outline"
              label={t('people.assignedServant')}
              value={
                assignedServant
                  ? `${assignedServant.first_name} ${assignedServant.last_name}`
                  : '—'
              }
            />
            <InfoRow
              icon="calendar-outline"
              label={t('people.registeredAt')}
              value={new Date(person.registered_at).toLocaleDateString()}
            />
            <InfoRow
              icon="id-card-outline"
              label={t('people.registrationType')}
              value={t(`people.registrationTypes.${person.registration_type}`)}
            />
          </View>

          {/* Comments (visible only to assigned servant + admin) */}
          {canSeeComments && person.comments && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('people.comments')}</Text>
              <View style={styles.commentsBox}>
                <Text style={styles.commentsText}>{person.comments}</Text>
              </View>
            </View>
          )}

          {/* Attendance history placeholder */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('people.attendanceHistory')}
            </Text>
            <Text style={styles.phaseNotice}>{t('people.attendancePhase3')}</Text>
          </View>

          {/* Follow-up history placeholder */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('people.followUpHistory')}</Text>
            <Text style={styles.phaseNotice}>{t('people.followUpPhase4')}</Text>
          </View>

          {/* Actions */}
          {canEdit && (
            <View style={styles.actionsSection}>
              <Button
                title={
                  isPaused
                    ? t('people.resumeAlerts')
                    : t('people.pauseAlerts')
                }
                onPress={handleTogglePause}
                variant="secondary"
                loading={updatePerson.isPending}
              />
              {isAdmin && (
                <Button
                  title={t('common.delete')}
                  onPress={handleDelete}
                  variant="destructive"
                  style={styles.deleteButton}
                />
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

interface InfoRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  onPress?: () => void;
}

function InfoRow({ icon, label, value, onPress }: InfoRowProps) {
  const content = (
    <View style={infoStyles.row}>
      <Ionicons name={icon} size={18} color={colors.inkSecondary} style={infoStyles.icon} />
      <View style={infoStyles.textContainer}>
        <Text style={infoStyles.label}>{label}</Text>
        <Text style={[infoStyles.value, onPress && infoStyles.valueLink]}>
          {value}
        </Text>
      </View>
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }
  return content;
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
  },
  content: {
    padding: spacing[5],
    paddingBottom: spacing[10],
  },
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing[5],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  name: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.h2,
    lineHeight: lineHeight.h2,
    color: colors.ink,
    flex: 1,
    marginRight: spacing[3],
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[1],
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    marginRight: spacing[2],
  },
  priorityLabel: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.bodySmall,
    color: colors.inkSecondary,
  },
  pausedBadge: {
    marginLeft: spacing[3],
    backgroundColor: colors.atRiskBg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  pausedBadgeText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.caption,
    color: colors.atRisk,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.h3,
    lineHeight: lineHeight.h3,
    color: colors.ink,
    marginBottom: spacing[3],
  },
  commentsBox: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing[3],
  },
  commentsText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    lineHeight: lineHeight.body,
    color: colors.ink,
  },
  phaseNotice: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.bodySmall,
    lineHeight: lineHeight.bodySmall,
    color: colors.inkTertiary,
    fontStyle: 'italic',
  },
  actionsSection: {
    marginTop: spacing[2],
  },
  deleteButton: {
    marginTop: spacing[3],
  },
  errorText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.absent,
  },
});

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  icon: {
    marginRight: spacing[3],
    marginTop: 2,
    width: 20,
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.bodySmall,
    lineHeight: lineHeight.bodySmall,
    color: colors.inkSecondary,
  },
  value: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.body,
    lineHeight: lineHeight.body,
    color: colors.ink,
  },
  valueLink: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});
