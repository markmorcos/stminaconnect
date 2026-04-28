/**
 * Notifications factory — verifies the env-var switch picks the right
 * implementation. The `real` path constructs a `RealNotificationService`
 * which adds the OS-side push surface; the `mock` path keeps the
 * deterministic `MockNotificationService`.
 */
/* eslint-disable import/first */
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: 'undetermined', granted: false })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted', granted: true })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[fake]' })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: { eas: { projectId: 'test-project' } }, name: 'test', version: '0.0.0' },
    deviceName: 'Test Device',
  },
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

import { createNotificationService } from '@/services/notifications';
import { MockNotificationService } from '@/services/notifications/MockNotificationService';
import { RealNotificationService } from '@/services/notifications/RealNotificationService';
/* eslint-enable import/first */

describe('createNotificationService', () => {
  it("returns a MockNotificationService when impl='mock'", () => {
    const service = createNotificationService('mock');
    expect(service).toBeInstanceOf(MockNotificationService);
  });

  it("returns a RealNotificationService when impl='real'", () => {
    const service = createNotificationService('real');
    expect(service).toBeInstanceOf(RealNotificationService);
    // Cleanup so the AppState listener doesn't leak across tests.
    void service.teardown();
  });
});
