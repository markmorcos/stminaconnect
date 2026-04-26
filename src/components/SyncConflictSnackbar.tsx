/**
 * Listens to `useSyncState.conflictedPersonName` and surfaces a Paper
 * Snackbar when set. Auto-clears the state after dismissal so the same
 * conflict doesn't re-fire on every render. Mounted once in the
 * authenticated layout.
 */
import { Snackbar } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import { useSyncState } from '@/services/sync/SyncEngine';

export function SyncConflictSnackbar() {
  const { t } = useTranslation();
  const name = useSyncState((s) => s.conflictedPersonName);
  const setConflictedPersonName = useSyncState((s) => s.setConflictedPersonName);
  return (
    <Snackbar
      visible={name !== null}
      onDismiss={() => setConflictedPersonName(null)}
      duration={6000}
    >
      {name ? t('sync.conflictToast', { name }) : ''}
    </Snackbar>
  );
}
