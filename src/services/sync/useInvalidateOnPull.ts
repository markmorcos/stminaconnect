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
 * Mounted once in `app/(app)/_layout.tsx`. Invalidates on every advance
 * of `lastPullAt`, including the first one. An earlier version skipped
 * the first transition on the assumption that screens couldn't mount
 * before the first pull (because `hasCompletedFirstPull` gates the
 * `(app)` layout), but in practice there are races — e.g. consent
 * redirect mid-pull, or screens that read query data before the pull's
 * SQLite writes flush — that leave the first batch of queries holding
 * an empty cached result for the QueryClient's `staleTime`. Always
 * invalidating costs at most one extra fetch per query at boot and
 * eliminates the failure mode entirely.
 */
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useSyncState } from './SyncEngine';

export function useInvalidateOnPull(): void {
  const queryClient = useQueryClient();
  const lastPullAt = useSyncState((s) => s.lastPullAt);
  const seen = useRef<string | null>(null);

  useEffect(() => {
    if (lastPullAt === null || lastPullAt === seen.current) return;
    seen.current = lastPullAt;
    void queryClient.invalidateQueries();
  }, [lastPullAt, queryClient]);
}
