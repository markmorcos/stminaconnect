import '@testing-library/jest-native/extend-expect';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Stop tests from calling the real expo-updates (and from blowing up
// because the native module isn't linked in the Jest environment).
jest.mock('expo-updates', () => ({
  reloadAsync: jest.fn(async () => {}),
}));

// Initialize i18next with the EN bundle so `useTranslation().t(...)`
// returns translated strings in tests instead of raw keys. The
// synchronous init in `src/i18n/index.ts` is what lets us do this here.
require('@/i18n');
