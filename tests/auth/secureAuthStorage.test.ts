/**
 * SecureStore migration — verifies the one-way AsyncStorage →
 * SecureStore copy is idempotent and preserves the token.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import {
  __SUPABASE_TOKEN_KEY,
  __resetAuthStorageMigrationForTests,
  migrateAuthStorageOnce,
  secureAuthStorage,
} from '@/services/storage/secureAuthStorage';

const reset = (SecureStore as unknown as { __resetSecureStoreForTests: () => void })
  .__resetSecureStoreForTests;

beforeEach(async () => {
  __resetAuthStorageMigrationForTests();
  reset();
  await AsyncStorage.clear();
});

describe('secureAuthStorage migration', () => {
  it('copies a legacy AsyncStorage value into SecureStore on first run', async () => {
    await AsyncStorage.setItem(__SUPABASE_TOKEN_KEY, 'legacy-token');

    await migrateAuthStorageOnce();

    expect(await secureAuthStorage.getItem(__SUPABASE_TOKEN_KEY)).toBe('legacy-token');
    expect(await AsyncStorage.getItem(__SUPABASE_TOKEN_KEY)).toBeNull();
  });

  it('is idempotent — calling twice produces the same end state', async () => {
    await AsyncStorage.setItem(__SUPABASE_TOKEN_KEY, 'legacy-token');

    await migrateAuthStorageOnce();
    __resetAuthStorageMigrationForTests();
    await migrateAuthStorageOnce();

    expect(await secureAuthStorage.getItem(__SUPABASE_TOKEN_KEY)).toBe('legacy-token');
    expect(await AsyncStorage.getItem(__SUPABASE_TOKEN_KEY)).toBeNull();
  });

  it('does not overwrite an existing SecureStore value', async () => {
    await secureAuthStorage.setItem(__SUPABASE_TOKEN_KEY, 'fresh-token');
    await AsyncStorage.setItem(__SUPABASE_TOKEN_KEY, 'stale-token');

    await migrateAuthStorageOnce();

    expect(await secureAuthStorage.getItem(__SUPABASE_TOKEN_KEY)).toBe('fresh-token');
    expect(await AsyncStorage.getItem(__SUPABASE_TOKEN_KEY)).toBeNull();
  });

  it('no-ops when AsyncStorage is empty', async () => {
    await migrateAuthStorageOnce();
    expect(await secureAuthStorage.getItem(__SUPABASE_TOKEN_KEY)).toBeNull();
  });
});
