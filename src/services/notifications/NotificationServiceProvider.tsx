/**
 * Wires `MockNotificationService` to the auth lifecycle:
 *   - On servant id appearing → refresh the inbox + ensure the Realtime
 *     channel is open.
 *   - On servant id disappearing → tear down channels and clear the
 *     local notifications store so a returning user starts fresh.
 *
 * The service instance itself is stable for the app's lifetime. We pass
 * it down via `NotificationServiceContext`; consumers read it through
 * `useNotificationService()` from `src/services/notifications`.
 */
import { useEffect, useRef, type ReactNode } from 'react';

import { useAuthStore } from '@/state/authStore';

import { createNotificationService, NotificationServiceContext } from './index';
import type { NotificationService } from './NotificationService';

export function NotificationServiceProvider({ children }: { children: ReactNode }) {
  const serviceRef = useRef<NotificationService | null>(null);
  if (serviceRef.current === null) {
    serviceRef.current = createNotificationService();
  }
  const service = serviceRef.current;

  const servantId = useAuthStore((s) => s.servant?.id ?? null);

  useEffect(() => {
    let cancelled = false;
    if (servantId) {
      service.refresh().catch(() => {
        // Refresh is best-effort; the inbox screen will surface a
        // visible error on its own pull-to-refresh.
      });
    } else {
      void service.teardown();
    }
    return () => {
      cancelled = true;
      // Only tear down on hard unmount — re-mounts during HMR re-enter
      // the effect above and will re-subscribe.
      void cancelled;
    };
  }, [service, servantId]);

  useEffect(
    () => () => {
      void service.teardown();
    },
    [service],
  );

  return (
    <NotificationServiceContext.Provider value={service}>
      {children}
    </NotificationServiceContext.Provider>
  );
}
