/**
 * Modal-presented form for setting a person on break.
 *
 * Inputs:
 *   - Duration toggle: Fixed date / Open-ended.
 *   - Date picker (only when Fixed date) — uses the Material-styled
 *     `DatePickerModal` from react-native-paper-dates so the calendar
 *     picks up our brand palette via Paper's theme.
 *   - Open-ended sets paused_until to 9999-12-31 server-side.
 *
 * On save calls `mark_on_break` and pops the modal. The `endBreak`
 * affordance lives on the profile screen, not here.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { DatePickerModal } from 'react-native-paper-dates';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';

import { Button, Card, Chip, Snackbar, Stack, Text, useTokens } from '@/design';
import { useLanguage } from '@/design/useLanguage';
import { markOnBreak, OPEN_ENDED_BREAK_DATE } from '@/services/api/onBreak';
import { haptics } from '@/utils/haptics';

function defaultPausedUntilDate(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d;
}

function toIsoDate(d: Date): string {
  // Use local Y-M-D so the user's chosen day isn't shifted by the device timezone.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function OnBreakScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  const lang = useLanguage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [openEnded, setOpenEnded] = useState(false);
  const [pausedDate, setPausedDate] = useState<Date>(defaultPausedUntilDate());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorSnack, setErrorSnack] = useState<string | null>(null);

  const personId = useMemo(() => (typeof id === 'string' ? id : ''), [id]);
  const minDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const onSave = async () => {
    const target = openEnded ? OPEN_ENDED_BREAK_DATE : toIsoDate(pausedDate);
    setSaving(true);
    try {
      await markOnBreak(personId, target);
      await queryClient.invalidateQueries({ queryKey: ['person', personId] });
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
              {t('persons.onBreak.durationLabel')}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Chip selected={!openEnded} onPress={() => setOpenEnded(false)}>
                {t('persons.onBreak.fixedDate')}
              </Chip>
              <Chip selected={openEnded} onPress={() => setOpenEnded(true)}>
                {t('persons.onBreak.openEnded')}
              </Chip>
            </View>
            {openEnded ? (
              <Text variant="bodySm" color={colors.textMuted}>
                {t('persons.onBreak.openEndedHint')}
              </Text>
            ) : (
              <Stack gap="xs">
                <Text variant="bodySm" color={colors.textMuted}>
                  {t('persons.onBreak.untilLabel')}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('persons.onBreak.untilLabel')}
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
                    {pausedDate.toLocaleDateString(undefined, {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                </Pressable>
              </Stack>
            )}
          </Stack>
        </Card>

        <Button onPress={() => void onSave()} loading={saving} disabled={saving}>
          {t('persons.onBreak.save')}
        </Button>
      </ScrollView>

      <DatePickerModal
        locale={lang}
        mode="single"
        visible={pickerOpen && !openEnded}
        onDismiss={() => setPickerOpen(false)}
        date={pausedDate}
        onConfirm={({ date }) => {
          setPickerOpen(false);
          if (date) setPausedDate(date);
        }}
        validRange={{ startDate: minDate }}
        saveLabel={t('persons.onBreak.save')}
      />

      <Snackbar visible={errorSnack !== null} onDismiss={() => setErrorSnack(null)} duration={4000}>
        {errorSnack ?? ''}
      </Snackbar>
    </View>
  );
}
