/**
 * Public entry point for the notifications service.
 *
 * Picks the implementation by `EXPO_PUBLIC_NOTIFICATION_DISPATCHER`
 * (default: `'mock'`). The `'real'` value is documented but currently
 * resolves to the mock — the real implementation lands in phase 17 and
 * will replace the right-hand side of the switch without changing
 * callers. The `useNotificationService()` hook is the only way feature
 * code is allowed to dispatch notifications (see the notifications
 * capability spec).
 */
import { createContext, useContext } from 'react';

import { useAuthStore } from '@/state/authStore';

import { MockNotificationService } from './MockNotificationService';
import type { NotificationService } from './NotificationService';

export type DispatcherImpl = 'mock' | 'real';

function readDispatcherEnv(): DispatcherImpl {
  const raw = process.env.EXPO_PUBLIC_NOTIFICATION_DISPATCHER;
  return raw === 'real' ? 'real' : 'mock';
}

export function createNotificationService(
  impl: DispatcherImpl = readDispatcherEnv(),
): NotificationService {
  // 'real' falls through to the mock today — the slot exists so phase 17
  // can land without touching callers. Don't throw: that would crash any
  // app that ships with the env flag set early.
  void impl;
  return new MockNotificationService({
    getServantId: () => useAuthStore.getState().servant?.id ?? null,
  });
}

export const NotificationServiceContext = createContext<NotificationService | null>(null);

export function useNotificationService(): NotificationService {
  const service = useContext(NotificationServiceContext);
  if (!service) {
    throw new Error('useNotificationService must be used inside <NotificationServiceProvider>');
  }
  return service;
}

export type { NotificationService } from './NotificationService';
export type {
  Notification,
  NotificationType,
  NotificationRow,
  NotificationPayloadFor,
  AbsenceAlertPayload,
  WelcomeBackPayload,
  ReassignmentPayload,
  SystemPayload,
} from './types';
export { notificationFromRow } from './types';
export { notificationRouter } from './notificationRouter';
