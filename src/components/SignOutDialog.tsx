/**
 * Sign-out dialog. Renders nothing while the queue is empty; when the
 * caller requests sign-out via `useSignOutWithGuard`, this component
 * checks the local queue and either signs out immediately or surfaces
 * the "Unsynced Changes" Paper Dialog. Two CTAs: "Stay logged in"
 * (default) and "Logout anyway" (clears the queue then signs out).
 */
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { Button as PaperButton, Dialog, Portal } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import { Text } from '@/design';
import { clearQueue, length as queueLength } from '@/services/db/repositories/queueRepo';
import { useAuthStore } from '@/state/authStore';

export interface SignOutGuard {
  /** Trigger the guarded sign-out. Either signs out or shows the dialog. */
  request: () => void;
  /** Render this component within the screen tree. */
  Dialog: () => ReactElement;
}

export function useSignOutWithGuard(): SignOutGuard {
  const { t } = useTranslation();
  const signOut = useAuthStore((s) => s.signOut);
  const [pending, setPending] = useState<number | null>(null);
  const isMounted = useRef(true);
  useEffect(
    () => () => {
      isMounted.current = false;
    },
    [],
  );

  const request = useCallback(() => {
    void (async () => {
      const count = await queueLength().catch(() => 0);
      if (count === 0) {
        await signOut();
        return;
      }
      if (isMounted.current) setPending(count);
    })();
  }, [signOut]);

  const onStay = useCallback(() => setPending(null), []);
  const onForce = useCallback(() => {
    void (async () => {
      await clearQueue().catch(() => null);
      setPending(null);
      await signOut();
    })();
  }, [signOut]);

  const DialogEl = useCallback(
    () => (
      <Portal>
        <Dialog visible={pending !== null} onDismiss={onStay}>
          <Dialog.Title>{t('sync.signOutDialog.title')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="body">{t('sync.signOutDialog.body', { count: pending ?? 0 })}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <PaperButton onPress={onStay}>{t('sync.signOutDialog.stay')}</PaperButton>
            <PaperButton onPress={onForce}>{t('sync.signOutDialog.logoutAnyway')}</PaperButton>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    ),
    [onForce, onStay, pending, t],
  );

  return { request, Dialog: DialogEl };
}
