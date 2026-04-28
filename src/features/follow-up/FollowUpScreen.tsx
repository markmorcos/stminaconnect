/**
 * Modal-presented form for logging a follow-up against a person.
 *
 * Inputs:
 *   - Action chip-row (single-select) — required.
 *   - Notes (multiline, ≤ 500 chars, optional).
 *   - Status toggle: completed / snoozed.
 *   - Snooze date picker (only when status='snoozed', defaults to +3 days).
 *     Uses `DatePickerModal` from react-native-paper-dates so the
 *     calendar inherits Paper's brand theme on both platforms.
 *
 * On save, calls `create_follow_up` and pops the modal. Used both as a
 * standalone destination (from profile "Log follow-up") and as the
 * deep-link target for `absence_alert` notifications via the
 * `?openFollowUp=true` query param on the profile route.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { DatePickerModal } from 'react-native-paper-dates';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';

import { Button, Card, Chip, Input, Snackbar, Stack, Text, useTokens } from '@/design';
import { useLanguage } from '@/design/useLanguage';
import { createFollowUp, type FollowUpAction, type FollowUpStatus } from '@/services/api/followUps';
import { haptics } from '@/utils/haptics';

const ACTIONS: FollowUpAction[] = ['called', 'texted', 'visited', 'no_answer', 'other'];
const STATUSES: FollowUpStatus[] = ['completed', 'snoozed'];

function defaultSnoozeDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d;
}

function toIsoDate(d: Date): string {
  // Use local Y-M-D so the user's chosen day isn't shifted by the device timezone.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function FollowUpScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  const lang = useLanguage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [action, setAction] = useState<FollowUpAction | null>(null);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<FollowUpStatus>('completed');
  const [snoozeDate, setSnoozeDate] = useState<Date>(defaultSnoozeDate());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [errors, setErrors] = useState<{ action?: string }>({});
  const [saving, setSaving] = useState(false);
  const [errorSnack, setErrorSnack] = useState<string | null>(null);

  const personId = useMemo(() => (typeof id === 'string' ? id : ''), [id]);
  const minSnoozeDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const onSave = async () => {
    const next: typeof errors = {};
    if (!action) next.action = t('followUps.errors.actionRequired');
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await createFollowUp({
        person_id: personId,
        action: action as FollowUpAction,
        notes: notes.trim() === '' ? null : notes.trim(),
        status,
        snooze_until: status === 'snoozed' ? toIsoDate(snoozeDate) : null,
      });
      await queryClient.invalidateQueries({ queryKey: ['follow-ups', 'pending'] });
      await queryClient.invalidateQueries({ queryKey: ['servant-dashboard'] });
      haptics.medium();
      router.back();
    } catch (e) {
      haptics.error();
      setErrorSnack((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Card padding="lg">
          <Stack gap="md">
            <Text variant="label" color={colors.textMuted}>
              {t('followUps.actionLabel')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {ACTIONS.map((a) => (
                <Chip
                  key={a}
                  selected={action === a}
                  onPress={() => {
                    setAction(a);
                    setErrors((prev) => ({ ...prev, action: undefined }));
                  }}
                >
                  {t(`followUps.action.${a}`)}
                </Chip>
              ))}
            </View>
            {errors.action ? (
              <Text variant="bodySm" color={colors.error}>
                {errors.action}
              </Text>
            ) : null}
          </Stack>
        </Card>

        <Card padding="lg">
          <Stack gap="md">
            <Text variant="label" color={colors.textMuted}>
              {t('followUps.notesLabel')}
            </Text>
            <Input
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              maxLength={500}
              placeholder={t('followUps.notesPlaceholder')}
              accessibilityLabel={t('followUps.notesLabel')}
            />
          </Stack>
        </Card>

        <Card padding="lg">
          <Stack gap="md">
            <Text variant="label" color={colors.textMuted}>
              {t('followUps.statusLabel')}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {STATUSES.map((s) => (
                <Chip key={s} selected={status === s} onPress={() => setStatus(s)}>
                  {t(`followUps.status.${s}`)}
                </Chip>
              ))}
            </View>
            {status === 'snoozed' ? (
              <Stack gap="xs">
                <Text variant="bodySm" color={colors.textMuted}>
                  {t('followUps.snoozeUntil')}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('followUps.snoozeUntil')}
                  onPress={() => setPickerOpen(true)}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    minHeight: 44,
                    justifyContent: 'center',
                  }}
                >
                  <Text variant="body">
                    {snoozeDate.toLocaleDateString(undefined, {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                </Pressable>
              </Stack>
            ) : null}
          </Stack>
        </Card>

        <Button onPress={() => void onSave()} loading={saving} disabled={saving}>
          {t('followUps.save')}
        </Button>
      </ScrollView>

      <DatePickerModal
        locale={lang}
        mode="single"
        visible={pickerOpen && status === 'snoozed'}
        onDismiss={() => setPickerOpen(false)}
        date={snoozeDate}
        onConfirm={({ date }) => {
          setPickerOpen(false);
          if (date) setSnoozeDate(date);
        }}
        validRange={{ startDate: minSnoozeDate }}
        saveLabel={t('followUps.save')}
      />

      <Snackbar visible={errorSnack !== null} onDismiss={() => setErrorSnack(null)} duration={4000}>
        {errorSnack ?? ''}
      </Snackbar>
    </View>
  );
}
