/**
 * Public entry point for the notifications service.
 *
 * Picks the implementation by `EXPO_PUBLIC_NOTIFICATION_DISPATCHER`
 * (default: `'mock'`). `'real'` selects `RealNotificationService` —
 * the real-push impl that registers an Expo push token, surfaces OS
 * notifications, and forwards taps to `notificationRouter`. The mock
 * stays available for tests and for environments without dev-build
 * native modules. The `useNotificationService()` hook is the only way
 * feature code is allowed to dispatch notifications (see the
 * notifications capability spec).
 */
import { createContext, useContext } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

import { useAuthStore } from '@/state/authStore';

import { MockNotificationService } from './MockNotificationService';
import {
  RealNotificationService,
  type ConstantsApi,
  type NotificationsApi,
} from './RealNotificationService';
import type { NotificationService } from './NotificationService';

export type DispatcherImpl = 'mock' | 'real';

function readDispatcherEnv(): DispatcherImpl {
  const raw = process.env.EXPO_PUBLIC_NOTIFICATION_DISPATCHER;
  return raw === 'real' ? 'real' : 'mock';
}

export function createNotificationService(
  impl: DispatcherImpl = readDispatcherEnv(),
): NotificationService {
  const getServantId = () => useAuthStore.getState().servant?.id ?? null;

  if (impl === 'real') {
    // Adapt the real expo-notifications + expo-constants modules to the
    // narrow interfaces RealNotificationService accepts. The cast is
    // safe: the runtime shape matches; the narrow types simply scope
    // what we depend on so tests can stub easily.
    const notificationsApi = Notifications as unknown as NotificationsApi;
    const constantsApi: ConstantsApi = {
      expoConfig: Constants.expoConfig as ConstantsApi['expoConfig'],
      deviceName: Constants.deviceName ?? null,
    };
    return new RealNotificationService({
      getServantId,
      notifications: notificationsApi,
      constants: constantsApi,
    });
  }

  return new MockNotificationService({ getServantId });
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
