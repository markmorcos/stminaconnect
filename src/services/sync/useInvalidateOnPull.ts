/**
 * Subscribes to `useSyncState.lastPullAt` and calls
 * `queryClient.invalidateQueries()` whenever the watermark advances.
 *
 * Why: TanStack Query reads from the SQLite mirror with no awareness of
 * when the SyncEngine writes new rows. Without this hook, screens like
 * the attendance picker show stale (often empty) data after an in-app
 * sync — e.g. immediately after a "Wipe local DB" + re-pull from the
 * /dev/db inspector, or any successful background pull that arrives
 * while a screen is mounted.
 *
 * Mounted once in `app/(app)/_layout.tsx`. Skips the initial render so
 * we don't double-fetch on app boot (`hasCompletedFirstPull` already
 * gates that path).
 */
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useSyncState } from './SyncEngine';

export function useInvalidateOnPull(): void {
  const queryClient = useQueryClient();
  const lastPullAt = useSyncState((s) => s.lastPullAt);
  const seen = useRef<string | null>(null);

  useEffect(() => {
    if (lastPullAt === seen.current) return;
    if (seen.current === null) {
      seen.current = lastPullAt;
      return;
    }
    seen.current = lastPullAt;
    void queryClient.invalidateQueries();
  }, [lastPullAt, queryClient]);
}
