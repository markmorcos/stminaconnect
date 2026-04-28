import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { secureAuthStorage } from '@/services/storage/secureAuthStorage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const missingSupabaseEnvVars: string[] = [
  ...(url ? [] : ['EXPO_PUBLIC_SUPABASE_URL']),
  ...(anonKey ? [] : ['EXPO_PUBLIC_SUPABASE_ANON_KEY']),
];

if (missingSupabaseEnvVars.length > 0) {
  for (const name of missingSupabaseEnvVars) {
    console.warn(`[supabase] Missing env var: ${name}`);
  }
}

export const supabase: SupabaseClient = createClient(
  url ?? 'http://localhost:54321',
  anonKey ?? 'public-anon-key-placeholder',
  {
    auth: {
      // SecureStore-backed adapter — tokens live in the iOS Keychain /
      // Android Keystore. AsyncStorage was the previous home; the
      // boot-time migration in `secureAuthStorage` copies any legacy
      // value across once.
      storage: secureAuthStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
