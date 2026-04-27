/**
 * Admin Alerts settings screen.
 *
 * Form fields:
 *   - global threshold (int ≥ 1)
 *   - per-priority thresholds (4 nullable ints; empty string = "use global")
 *   - notify-admin-on-alert (toggle)
 *   - escalation threshold (nullable int)
 *
 * Buttons:
 *   - Save → update_alert_config
 *   - Recalculate now → recalculate_absences (returns alert count for snackbar)
 */
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Card, Chip, Input, Snackbar, Spinner, Stack, Text, useTokens } from '@/design';
import {
  getAlertConfig,
  recalculateAbsences,
  updateAlertConfig,
  type AlertConfig,
  type Priority,
  type PriorityThresholds,
} from '@/services/api/alertConfig';

const PRIORITIES: Priority[] = ['high', 'medium', 'low', 'very_low'];

interface FormState {
  globalThreshold: string;
  priorityThresholds: Record<Priority, string>;
  notifyAdmin: boolean;
  escalationThreshold: string;
  gracePeriodDays: string;
}

function fromConfig(cfg: AlertConfig): FormState {
  const map: Record<Priority, string> = {
    high: '',
    medium: '',
    low: '',
    very_low: '',
  };
  for (const p of PRIORITIES) {
    const v = cfg.priority_thresholds?.[p];
    map[p] = v == null ? '' : String(v);
  }
  return {
    globalThreshold: String(cfg.absence_threshold),
    priorityThresholds: map,
    notifyAdmin: cfg.notify_admin_on_alert,
    escalationThreshold: cfg.escalation_threshold == null ? '' : String(cfg.escalation_threshold),
    gracePeriodDays: String(cfg.grace_period_days ?? 3),
  };
}

function parseNonNegInt(s: string): number | null {
  const trimmed = s.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

function parsePosInt(s: string): number | null {
  const trimmed = s.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

export function AlertsScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();

  const [config, setConfig] = useState<AlertConfig | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [snack, setSnack] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await getAlertConfig();
        if (cancelled) return;
        setConfig(cfg);
        setForm(fromConfig(cfg));
      } catch (e) {
        if (!cancelled) setSnack({ message: (e as Error).message, tone: 'error' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !form || !config) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
      </View>
    );
  }

  const onSave = async () => {
    const globalN = parsePosInt(form.globalThreshold);
    if (globalN == null) {
      setSnack({ message: t('admin.alerts.errors.invalidGlobal'), tone: 'error' });
      return;
    }

    const pri: PriorityThresholds = {};
    for (const p of PRIORITIES) {
      const raw = form.priorityThresholds[p];
      if (raw.trim() === '') {
        pri[p] = null;
      } else {
        const n = parsePosInt(raw);
        if (n == null) {
          setSnack({
            message: t('admin.alerts.errors.invalidPriority', {
              priority: t(`admin.alerts.priorityThresholds.${p}`),
            }),
            tone: 'error',
          });
          return;
        }
        pri[p] = n;
      }
    }

    const escTrimmed = form.escalationThreshold.trim();
    const escNullable = escTrimmed === '' ? null : parsePosInt(escTrimmed);
    if (escTrimmed !== '' && escNullable == null) {
      setSnack({ message: t('admin.alerts.errors.invalidEscalation'), tone: 'error' });
      return;
    }

    const graceN = parseNonNegInt(form.gracePeriodDays);
    if (graceN == null) {
      setSnack({ message: t('admin.alerts.errors.invalidGrace'), tone: 'error' });
      return;
    }

    setSaving(true);
    try {
      const updated = await updateAlertConfig({
        absenceThreshold: globalN,
        priorityThresholds: pri,
        notifyAdminOnAlert: form.notifyAdmin,
        escalationThreshold: escNullable,
        gracePeriodDays: graceN,
      });
      setConfig(updated);
      setForm(fromConfig(updated));
      setSnack({ message: t('admin.alerts.success'), tone: 'success' });
    } catch (e) {
      setSnack({ message: (e as Error).message, tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const onRecalculate = async () => {
    setRecalculating(true);
    try {
      const inserted = await recalculateAbsences();
      setSnack({
        message: t('admin.alerts.recalculateResult', { count: inserted }),
        tone: 'success',
      });
    } catch (e) {
      setSnack({ message: (e as Error).message, tone: 'error' });
    } finally {
      setRecalculating(false);
    }
  };

  const setPriorityField = (p: Priority, value: string) => {
    setForm((prev) =>
      prev ? { ...prev, priorityThresholds: { ...prev.priorityThresholds, [p]: value } } : prev,
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Card padding="lg">
          <Stack gap="md">
            <Text variant="label" color={colors.textMuted}>
              {t('admin.alerts.globalThreshold')}
            </Text>
            <Input
              value={form.globalThreshold}
              onChangeText={(v) =>
                setForm((prev) => (prev ? { ...prev, globalThreshold: v } : prev))
              }
              keyboardType="number-pad"
              accessibilityLabel={t('admin.alerts.globalThreshold')}
            />
          </Stack>
        </Card>

        <Card padding="lg">
          <Stack gap="md">
            <Text variant="label" color={colors.textMuted}>
              {t('admin.alerts.priorityThresholds.title')}
            </Text>
            <Text variant="bodySm" color={colors.textMuted}>
              {t('admin.alerts.priorityThresholds.hint')}
            </Text>
            {PRIORITIES.map((p) => (
              <Stack key={p} gap="xs">
                <Text variant="body">{t(`admin.alerts.priorityThresholds.${p}`)}</Text>
                <Input
                  value={form.priorityThresholds[p]}
                  onChangeText={(v) => setPriorityField(p, v)}
                  keyboardType="number-pad"
                  placeholder={t('admin.alerts.useGlobal')}
                  accessibilityLabel={t(`admin.alerts.priorityThresholds.${p}`)}
                />
              </Stack>
            ))}
          </Stack>
        </Card>

        <Card padding="lg">
          <Stack gap="md">
            <Text variant="label" color={colors.textMuted}>
              {t('admin.alerts.notifyAdmin')}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Chip
                selected={form.notifyAdmin}
                onPress={() => setForm((prev) => (prev ? { ...prev, notifyAdmin: true } : prev))}
              >
                {t('admin.alerts.notifyAdminOn')}
              </Chip>
              <Chip
                selected={!form.notifyAdmin}
                onPress={() => setForm((prev) => (prev ? { ...prev, notifyAdmin: false } : prev))}
              >
                {t('admin.alerts.notifyAdminOff')}
              </Chip>
            </View>
          </Stack>
        </Card>

        <Card padding="lg">
          <Stack gap="md">
            <Text variant="label" color={colors.textMuted}>
              {t('admin.alerts.escalationThreshold')}
            </Text>
            <Text variant="bodySm" color={colors.textMuted}>
              {t('admin.alerts.escalationHint')}
            </Text>
            <Input
              value={form.escalationThreshold}
              onChangeText={(v) =>
                setForm((prev) => (prev ? { ...prev, escalationThreshold: v } : prev))
              }
              keyboardType="number-pad"
              placeholder={t('admin.alerts.escalationPlaceholder')}
              accessibilityLabel={t('admin.alerts.escalationThreshold')}
            />
          </Stack>
        </Card>

        <Card padding="lg">
          <Stack gap="md">
            <Text variant="label" color={colors.textMuted}>
              {t('admin.alerts.gracePeriod')}
            </Text>
            <Text variant="bodySm" color={colors.textMuted}>
              {t('admin.alerts.gracePeriodHint')}
            </Text>
            <Input
              value={form.gracePeriodDays}
              onChangeText={(v) =>
                setForm((prev) => (prev ? { ...prev, gracePeriodDays: v } : prev))
              }
              keyboardType="number-pad"
              accessibilityLabel={t('admin.alerts.gracePeriod')}
            />
          </Stack>
        </Card>

        <Stack gap="sm">
          <Button onPress={onSave} disabled={saving} loading={saving}>
            {t('admin.alerts.save')}
          </Button>
          <Button
            variant="secondary"
            onPress={onRecalculate}
            disabled={recalculating}
            loading={recalculating}
          >
            {t('admin.alerts.recalculate')}
          </Button>
        </Stack>
      </ScrollView>

      <Snackbar visible={snack !== null} onDismiss={() => setSnack(null)} duration={4000}>
        {snack?.message ?? ''}
      </Snackbar>
    </View>
  );
}
