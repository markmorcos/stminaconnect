/**
 * Notifications settings — quiet-hours toggle + start/end pickers and
 * the "permission denied" affordance.
 *
 * Server-side fields live on `public.servants` (added in `038_quiet_hours.sql`):
 *   - `language` (already managed via the language settings screen; we
 *     pass `null` here so the RPC keeps the existing value).
 *   - `quiet_hours_enabled` (bool).
 *   - `quiet_hours_start`, `quiet_hours_end` (time, Europe/Berlin).
 *
 * On mount we read the current values via `get_my_servant` (the same
 * RPC the auth layer uses) and seed local form state. Save dispatches
 * through `update_my_notification_settings` and invalidates the auth
 * store so `quiet_hours_enabled` propagates.
 *
 * Permission check uses `expo-notifications` — when the OS has denied
 * permission, the bottom card surfaces a "Notifications disabled by OS"
 * panel with a button that deep-links via `Linking.openSettings()`.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  type AppStateStatus,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  View,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { useTranslation } from 'react-i18next';
import { TimePickerModal } from 'react-native-paper-dates';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button, Card, Snackbar, Stack, Text, useTokens } from '@/design';
import { supabase } from '@/services/api/supabase';

interface MyServantRow {
  language: string | null;
  quiet_hours_enabled: boolean | null;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

interface TimeOfDay {
  hours: number;
  minutes: number;
}

const DEFAULT_START: TimeOfDay = { hours: 22, minutes: 0 };
const DEFAULT_END: TimeOfDay = { hours: 7, minutes: 0 };

export default function NotificationsSettingsScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  const qc = useQueryClient();

  // ---------------------------------------------------------------------
  // OS permission state — drives the bottom card.
  // ---------------------------------------------------------------------

  const [permGranted, setPermGranted] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;

    // Re-runs on every "did the user maybe just toggle this in
    // Settings?" trigger: initial mount AND every AppState
    // background→active transition. Without the AppState refresh, the
    // "Notifications disabled by OS" panel stays stuck after the user
    // visits the system settings, flips the switch, and returns.
    const refresh = async () => {
      try {
        const status = await Notifications.getPermissionsAsync();
        if (!cancelled) setPermGranted(!!status.granted);
      } catch {
        if (!cancelled) setPermGranted(false);
      }
    };
    void refresh();

    let prev: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      if (prev !== 'active' && next === 'active') {
        void refresh();
      }
      prev = next;
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  // ---------------------------------------------------------------------
  // Server state load — seeds local form on first render.
  // ---------------------------------------------------------------------

  const settingsQuery = useQuery({
    queryKey: ['settings', 'notifications'],
    queryFn: async (): Promise<MyServantRow> => {
      const { data, error } = await supabase.rpc('get_my_servant');
      if (error) throw error;
      const row = (data ?? null) as MyServantRow | null;
      return (
        row ?? {
          language: null,
          quiet_hours_enabled: false,
          quiet_hours_start: null,
          quiet_hours_end: null,
        }
      );
    },
    staleTime: 30_000,
  });

  const [enabled, setEnabled] = useState(false);
  const [start, setStart] = useState<TimeOfDay>(DEFAULT_START);
  const [end, setEnd] = useState<TimeOfDay>(DEFAULT_END);
  const [pickerOpen, setPickerOpen] = useState<'start' | 'end' | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  // Seed local form state from the server payload exactly once. We
  // guard with a ref because TanStack Query's `data` reference can
  // change across renders (background refetch, Realtime tickle, query
  // invalidation after `save`) — without the guard a refetch would
  // overwrite an in-progress toggle/picker change with the stale
  // server state and the user's edit would silently revert.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!settingsQuery.data || seededRef.current) return;
    seededRef.current = true;
    setEnabled(!!settingsQuery.data.quiet_hours_enabled);
    setStart(parseTime(settingsQuery.data.quiet_hours_start) ?? DEFAULT_START);
    setEnd(parseTime(settingsQuery.data.quiet_hours_end) ?? DEFAULT_END);
  }, [settingsQuery.data]);

  // ---------------------------------------------------------------------
  // Save mutation
  // ---------------------------------------------------------------------

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('update_my_notification_settings', {
        // Keep existing language: pass null to skip the column update.
        language: null,
        quiet_hours_enabled: enabled,
        quiet_hours_start: enabled ? formatTime(start) : null,
        quiet_hours_end: enabled ? formatTime(end) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSnack(t('settings.notifications.success'));
      void qc.invalidateQueries({ queryKey: ['settings', 'notifications'] });
    },
    onError: (e: unknown) => {
      setSnack(e instanceof Error ? e.message : 'save failed');
    },
  });

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  const startLabel = useMemo(() => formatTime(start), [start]);
  const endLabel = useMemo(() => formatTime(end), [end]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Stack gap="sm">
          <Text variant="label" color={colors.textMuted}>
            {t('settings.notifications.quietHours')}
          </Text>
          <Card padding="lg">
            <Stack gap="md">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyLg" style={{ fontWeight: '600' }}>
                    {t('settings.notifications.enable')}
                  </Text>
                  <Text variant="bodySm" color={colors.textMuted}>
                    {t('settings.notifications.enableHint')}
                  </Text>
                </View>
                <Switch
                  accessibilityLabel={t('settings.notifications.enable')}
                  value={enabled}
                  onValueChange={setEnabled}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>

              {enabled ? (
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('settings.notifications.start')}
                    onPress={() => setPickerOpen('start')}
                    style={({ pressed }) => [
                      {
                        flex: 1,
                        opacity: pressed ? 0.85 : 1,
                        padding: spacing.md,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 12,
                      },
                    ]}
                  >
                    <Text variant="caption" color={colors.textMuted}>
                      {t('settings.notifications.start')}
                    </Text>
                    <Text variant="headingSm">{startLabel}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('settings.notifications.end')}
                    onPress={() => setPickerOpen('end')}
                    style={({ pressed }) => [
                      {
                        flex: 1,
                        opacity: pressed ? 0.85 : 1,
                        padding: spacing.md,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 12,
                      },
                    ]}
                  >
                    <Text variant="caption" color={colors.textMuted}>
                      {t('settings.notifications.end')}
                    </Text>
                    <Text variant="headingSm">{endLabel}</Text>
                  </Pressable>
                </View>
              ) : null}
            </Stack>
          </Card>
        </Stack>

        <Button
          onPress={() => save.mutate()}
          loading={save.isPending}
          disabled={save.isPending || settingsQuery.isLoading}
        >
          {t('settings.notifications.save')}
        </Button>

        {permGranted === false ? (
          <Card padding="lg">
            <Stack gap="md">
              <Text variant="bodyLg" style={{ fontWeight: '600' }}>
                {t('permissions.notifications.deniedTitle')}
              </Text>
              <Text variant="bodySm" color={colors.textMuted}>
                {t('permissions.notifications.deniedBody')}
              </Text>
              <Button
                variant="secondary"
                onPress={() => {
                  void Linking.openSettings();
                }}
              >
                {t('permissions.notifications.openSystemSettings')}
              </Button>
            </Stack>
          </Card>
        ) : null}
      </ScrollView>

      <TimePickerModal
        visible={pickerOpen !== null}
        onDismiss={() => setPickerOpen(null)}
        onConfirm={({ hours, minutes }) => {
          if (pickerOpen === 'start') setStart({ hours, minutes });
          else if (pickerOpen === 'end') setEnd({ hours, minutes });
          setPickerOpen(null);
        }}
        hours={pickerOpen === 'end' ? end.hours : start.hours}
        minutes={pickerOpen === 'end' ? end.minutes : start.minutes}
        use24HourClock={Platform.OS === 'android'}
        label={
          pickerOpen === 'end' ? t('settings.notifications.end') : t('settings.notifications.start')
        }
      />

      <Snackbar visible={snack !== null} onDismiss={() => setSnack(null)} duration={3000}>
        {snack ?? ''}
      </Snackbar>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers — pure
// ---------------------------------------------------------------------------

/** "HH:MM:SS" / "HH:MM" → {hours, minutes}; null on parse failure. */
function parseTime(value: string | null): TimeOfDay | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

/** {hours, minutes} → "HH:MM" — what the RPC accepts. */
function formatTime(t: TimeOfDay): string {
  return `${String(t.hours).padStart(2, '0')}:${String(t.minutes).padStart(2, '0')}`;
}
