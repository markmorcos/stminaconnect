import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';

import { Stack, Text, useTokens } from '@/design';
import { supabase } from '@/services/api/supabase';

type Status = 'pending' | 'done' | 'error';

/**
 * Handles the magic-link redirect. Supabase's email link arrives at
 * `<scheme>://auth/callback?code=…`. We exchange the code for a
 * session, then bounce home — the auth listener inside the store
 * picks up the new session and updates `useAuth()`.
 */
export default function AuthCallback() {
  const { t } = useTranslation();
  const { colors } = useTokens();
  const [status, setStatus] = useState<Status>('pending');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = await Linking.getInitialURL();
        const { queryParams } = url ? Linking.parse(url) : { queryParams: null };
        const code = typeof queryParams?.code === 'string' ? queryParams.code : null;
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }
        if (!cancelled) setStatus('done');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'done') return <Redirect href="/" />;
  if (status === 'error') return <Redirect href="/sign-in" />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack flex={1} align="center" justify="center" gap="md">
        <ActivityIndicator color={colors.primary} />
        <Text variant="body" color={colors.textMuted}>
          {t('auth.callback.signingIn')}
        </Text>
      </Stack>
    </View>
  );
}
