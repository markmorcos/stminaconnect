/**
 * Messenger-style sync status bar. A thin, full-width strip that
 * appears just below the system status bar and surfaces the engine's
 * current state. Three render modes:
 *
 *   - hidden:   queue empty, nothing in flight, no recent transition.
 *   - busy:     amber strip with a spinner; rendered while `pulling`,
 *               `pushing`, or while ops sit in the queue. Shows the
 *               pending count when known.
 *   - synced:   green strip flashed for ~2s after the queue drains
 *               (busy → idle transition), then auto-hides.
 *
 * Tapping the bar opens a Paper Dialog with the same details panel
 * the previous icon-button surfaced (last-sync timestamp, queue
 * length, "Sync now" button). Pull-to-refresh on lists/roster remains
 * the manual escape hatch for the rest of the time.
 *
 * The component renders nothing when hidden, so the (app) layout's
 * absolute overlay row collapses out of the way of header actions
 * (3-dot menu etc.) the vast majority of the time.
 */
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Button as PaperButton, Dialog, Portal } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Icon, Text, useTokens } from '@/design';
import { getSyncEngine, useSyncState } from '@/services/sync/SyncEngine';

const SYNCED_PULSE_MS = 2_000;

type Variant = 'busy' | 'synced';

export function SyncStatusIndicator() {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTokens();
  const router = useRouter();
  const status = useSyncState((s) => s.status);
  const queueLength = useSyncState((s) => s.queueLength);
  const lastPullAt = useSyncState((s) => s.lastPullAt);
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [showSyncedPulse, setShowSyncedPulse] = useState(false);
  const wasBusy = useRef(false);

  const isInFlight = status === 'pulling' || status === 'pushing';
  const isErrored = status === 'offline' || status === 'error';
  const busy = isInFlight || queueLength > 0 || isErrored;

  // Detect busy → idle transition; flash a green "Synced" pulse for
  // SYNCED_PULSE_MS, then hide. Captures the moment the queue drains
  // or a manual sync completes.
  useEffect(() => {
    if (!busy && wasBusy.current) {
      setShowSyncedPulse(true);
      const timer = setTimeout(() => setShowSyncedPulse(false), SYNCED_PULSE_MS);
      wasBusy.current = false;
      return () => clearTimeout(timer);
    }
    wasBusy.current = busy;
    return undefined;
  }, [busy]);

  // Subtle pulse loop while pulling/pushing — drops 0.7 → 1.0 opacity
  // every ~900ms so the bar feels alive without becoming a strobe.
  // Honours OS reduce-motion: collapses to a static fully-opaque bar.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      if (mounted) setReduceMotion(value);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const pulseOpacity = useSharedValue(1);
  useEffect(() => {
    if (isInFlight && !reduceMotion) {
      pulseOpacity.value = 0.7;
      pulseOpacity.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
    } else {
      cancelAnimation(pulseOpacity);
      pulseOpacity.value = 1;
    }
  }, [isInFlight, reduceMotion, pulseOpacity]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulseOpacity.value }));

  if (!busy && !showSyncedPulse) return null;

  const variant: Variant = busy ? 'busy' : 'synced';
  const bg = variant === 'busy' ? colors.warning : colors.success;
  const fg = colors.textInverse;

  const label =
    variant === 'synced'
      ? t('sync.bar.synced')
      : isInFlight
        ? queueLength > 0
          ? t('sync.bar.syncingWithCount', { count: queueLength })
          : t('sync.bar.syncing')
        : t('sync.bar.pending', { count: queueLength });

  const onSyncNow = async () => {
    setRunning(true);
    try {
      await getSyncEngine().runOnce();
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <Animated.View style={pulseStyle}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => setOpen(true)}
          style={{
            backgroundColor: bg,
            paddingVertical: spacing.xs,
            paddingHorizontal: spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.xs,
          }}
        >
          {variant === 'busy' && isInFlight ? (
            <ActivityIndicator size="small" color={fg} />
          ) : (
            <Icon name={variant === 'busy' ? 'alertCircle' : 'check'} size={14} color={fg} />
          )}
          <Text variant="bodySm" color={fg} style={{ fontWeight: '600' }}>
            {label}
          </Text>
        </Pressable>
      </Animated.View>

      <Portal>
        <Dialog visible={open} onDismiss={() => setOpen(false)}>
          <Dialog.Title>{t('sync.panel.title')}</Dialog.Title>
          <Dialog.Content>
            <View style={{ gap: spacing.xs }}>
              <Text variant="body">
                {lastPullAt
                  ? t('sync.panel.lastSync', {
                      when: new Date(lastPullAt).toLocaleString(i18n.language),
                    })
                  : t('sync.panel.lastSyncNever')}
              </Text>
              <Text variant="body">{t('sync.panel.queueLength', { count: queueLength })}</Text>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <PaperButton
              onPress={() => {
                setOpen(false);
                router.push('/sync-issues');
              }}
            >
              {t('sync.panel.viewIssues')}
            </PaperButton>
            <PaperButton onPress={() => setOpen(false)}>{t('common.actions.cancel')}</PaperButton>
            <PaperButton
              onPress={() => {
                void onSyncNow();
              }}
              loading={running}
              disabled={running}
            >
              {t('sync.panel.syncNow')}
            </PaperButton>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}
