import '@testing-library/jest-native/extend-expect';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// react-native-reanimated ships a Jest-friendly mock that resolves
// `useSharedValue`, `useAnimatedStyle`, and the worklet primitives
// without spinning up the worklet runtime. Components built on
// reanimated (animated `LoadingSkeleton`, `Button` press scale, sync
// indicator pulse, roster row bounce) render normally under Jest.
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// expo-haptics resolves to native module bindings that aren't linked
// in Jest. Stub the surface so the wrapper at `src/utils/haptics.ts`
// can be imported without crashing tests; assertions about haptic
// calls happen via the wrapper, not the underlying module.
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Warning: 'Warning', Error: 'Error' },
}));

// react-native-paper-dates pulls in ESM-flavoured modules that Jest
// doesn't transpile by default. Tests don't render the calendar; stub
// the surface so production imports compile in the test environment.
jest.mock('react-native-paper-dates', () => ({
  DatePickerModal: () => null,
  registerTranslation: jest.fn(),
  en: {},
  ar: {},
  de: {},
}));

// Stop tests from calling the real expo-updates (and from blowing up
// because the native module isn't linked in the Jest environment).
jest.mock('expo-updates', () => ({
  reloadAsync: jest.fn(async () => {}),
}));

// expo-sqlite hits the native module at module load (via expo-asset).
// Stub the surface so unit tests that import the database layer don't
// require the full Expo runtime; specific tests still inject fakes via
// `__setDatabaseForTests` / `jest.mock('@/services/db/database', ...)`.
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => ({
    execAsync: jest.fn(),
    runAsync: jest.fn(async () => ({ lastInsertRowId: 0, changes: 0 })),
    getAllAsync: jest.fn(async () => []),
    withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => {
      await fn();
    }),
  })),
}));

// expo-network's native module isn't available in jest. Tests that
// drive the SyncEngine bootstrap layer either re-mock this module or
// rely on the listener returning a noop unsubscribe.
jest.mock('expo-network', () => ({
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
  getNetworkStateAsync: jest.fn(async () => ({
    isConnected: true,
    isInternetReachable: true,
  })),
  useNetworkState: jest.fn(() => ({ isConnected: true, isInternetReachable: true })),
}));

// `services/api/supabase.ts` creates a real `@supabase/supabase-js`
// client at module load with `autoRefreshToken: true`, which schedules
// a recurring token-refresh timer that keeps the jest worker's event
// loop alive (→ "worker process has failed to exit gracefully").
// Tests that need specific supabase behaviour still mock this module
// per-file; this default just neutralizes the live timers everywhere
// else.
jest.mock('@/services/api/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({ data: { session: null }, error: null })),
      signInWithPassword: jest.fn(),
      signInWithOtp: jest.fn(),
      verifyOtp: jest.fn(),
      signOut: jest.fn(async () => ({ error: null })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      exchangeCodeForSession: jest.fn(),
    },
    rpc: jest.fn(async () => ({ data: null, error: null })),
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn(async () => ({ data: [], error: null })),
    })),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
    })),
    removeChannel: jest.fn(async () => undefined),
  },
  missingSupabaseEnvVars: [],
}));

// Initialize i18next with the EN bundle so `useTranslation().t(...)`
// returns translated strings in tests instead of raw keys. The
// synchronous init in `src/i18n/index.ts` is what lets us do this here.
require('@/i18n');

// Module-level setTimeout calls that survive across tests cause
// jest-worker to hang on shutdown ("worker process has failed to
// exit gracefully"). Two known sources:
//
//   1. notificationsStore.bannerTimer — 8s auto-dismiss when a banner
//      is shown. Stranded in any test that surfaces a banner.
//   2. SyncEngine module-level singleton — `kickTimer` (50ms debounce)
//      and `retryTimer` (≤60s) scheduled by `runOnce()` whenever the
//      queue still has pending ops.
//
// Reset both in a global afterEach so nothing leaks between test
// files. Tests that mock these modules end up with stubs that don't
// expose the reset helpers — those tests have no real timers to
// leak, so the no-op is correct.
afterEach(async () => {
  const notificationsStore = require('@/state/notificationsStore');
  if (typeof notificationsStore.__resetNotificationsStoreForTests === 'function') {
    notificationsStore.__resetNotificationsStoreForTests();
  }
  const syncEngine = require('@/services/sync/SyncEngine');
  if (typeof syncEngine.__resetSyncEngineSingletonForTests === 'function') {
    await syncEngine.__resetSyncEngineSingletonForTests();
  }
});
