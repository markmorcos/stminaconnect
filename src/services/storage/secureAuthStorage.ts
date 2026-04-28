/**
 * SecureStore-backed auth storage for the Supabase JS client.
 *
 * Why: AsyncStorage is unencrypted on disk on both iOS (NSUserDefaults
 * via the JS bridge) and Android (sandboxed but unencrypted). Auth
 * tokens — refresh tokens especially — should sit behind the platform
 * keystore. `expo-secure-store` is Expo Go-compatible and uses the
 * iOS Keychain / Android Keystore under the hood.
 *
 * The shape mirrors `Storage` (the contract Supabase JS expects via
 * its `auth.storage` option): `getItem` / `setItem` / `removeItem`
 * returning Promises (or sync values; Supabase handles both).
 *
 * SecureStore caps individual values at 2 KiB. Supabase tokens are
 * comfortably under that — empirical sizes hover at ~1 KiB — but we
 * keep the assumption documented so a future field bump is caught.
 *
 * Boot-time migration from AsyncStorage lives in
 * `migrateAuthStorageOnce()`, called once from the app root layout.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * The single Supabase auth key used by `@supabase/supabase-js` v2.
 * Concrete value follows the supabase-js convention; it's stable
 * across SDK versions because we don't pass a custom storageKey.
 */
const SUPABASE_TOKEN_KEY = 'sb-stmina-auth-token';

/**
 * SecureStore disallows several characters in keys. Supabase keys
 * contain `-`, which is allowed; the helper is here so we can swap
 * without touching call sites if the schema ever changes.
 */
function safeKey(key: string): string {
  return key;
}

export const secureAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(safeKey(key));
    } catch {
      // SecureStore can throw on locked-keystore states (e.g. user
      // hasn't enrolled a device passcode). Treat that as "no value"
      // so the auth client just shows the sign-in screen rather than
      // crashing on boot.
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(safeKey(key), value);
    } catch {
      // Best-effort. A failure here means the session won't persist
      // across cold starts; the user reauths on next launch. Better
      // than a boot-time crash.
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(safeKey(key));
    } catch {
      // No-op for the same reason as setItem.
    }
  },
};

let migrationDone = false;

/**
 * One-way migration from AsyncStorage → SecureStore.
 *
 *   - Reads the supabase auth blob from AsyncStorage.
 *   - If present AND SecureStore doesn't already hold a value,
 *     copies it across and removes the AsyncStorage entry.
 *   - Idempotent: a second invocation no-ops because either
 *     AsyncStorage is empty or SecureStore is now populated.
 *
 * Failures are swallowed — the next sign-in will simply re-create
 * the SecureStore entry directly. Crashing the app on boot for a
 * storage-migration nit is the wrong trade.
 */
export async function migrateAuthStorageOnce(): Promise<void> {
  if (migrationDone) return;
  migrationDone = true;
  try {
    const legacy = await AsyncStorage.getItem(SUPABASE_TOKEN_KEY);
    if (legacy === null) return;
    const existing = await secureAuthStorage.getItem(SUPABASE_TOKEN_KEY);
    if (existing === null) {
      await secureAuthStorage.setItem(SUPABASE_TOKEN_KEY, legacy);
    }
    await AsyncStorage.removeItem(SUPABASE_TOKEN_KEY);
  } catch {
    // Best-effort.
  }
}

/** Test helper: re-enable the migration so a single test can re-run it. */
export function __resetAuthStorageMigrationForTests(): void {
  migrationDone = false;
}

export const __SUPABASE_TOKEN_KEY = SUPABASE_TOKEN_KEY;
