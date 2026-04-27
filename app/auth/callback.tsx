import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';

import { Stack, Text, useTokens } from '@/design';
import { supabase } from '@/services/api/supabase';

type Status = 'pending' | 'done' | 'error';

/**
 * Handles the magic-link redirect. Two URL shapes can land here:
 *
 *   1. PKCE / OTP flow → `?code=…` query param. Exchanged via
 *      `exchangeCodeForSession`. This is the path `signInWithOtp` uses.
 *   2. Implicit flow (Supabase invite emails) → `#access_token=…&
 *      refresh_token=…&type=invite` in the URL fragment. Set directly
 *      via `setSession`.
 *
 * The screen also subscribes to live URL events: if the app is already
 * running in Expo Go when the user taps the email link, the OS pushes
 * the URL through the Linking listener rather than the cold-start
 * `getInitialURL` call.
 */
export default function AuthCallback() {
  const { t } = useTranslation();
  const { colors } = useTokens();
  const [status, setStatus] = useState<Status>('pending');

  useEffect(() => {
    let cancelled = false;

    async function consume(url: string | null): Promise<void> {
      if (!url || cancelled) return;
      try {
        const parsed = Linking.parse(url);
        const code = typeof parsed.queryParams?.code === 'string' ? parsed.queryParams.code : null;
        const fragment = extractFragment(url);
        const accessToken = fragment.get('access_token');
        const refreshToken = fragment.get('refresh_token');

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          if (!cancelled) setStatus('done');
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          if (!cancelled) setStatus('done');
        } else {
          // No auth payload reached us. On Android Expo Go this is the
          // expected outcome of an invite/magic-link tap: the OS strips
          // the URL path + fragment when handing off the custom scheme,
          // so the access_token never reaches the app. Bail to sign-in
          // immediately rather than spinning — the user can paste the
          // 6-digit code from the email if their flow includes one, or
          // open the link from a dev-build (which preserves the URL).
          if (!cancelled) setStatus('error');
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    void Linking.getInitialURL().then((url) => consume(url));
    const sub = Linking.addEventListener('url', ({ url }) => {
      void consume(url);
    });
    return () => {
      cancelled = true;
      sub.remove();
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

/**
 * Extracts the URL fragment (`#…`) into a URLSearchParams. `Linking.parse`
 * only surfaces query params, not the fragment Supabase uses for
 * implicit-flow tokens.
 */
function extractFragment(url: string): URLSearchParams {
  const hashIdx = url.indexOf('#');
  if (hashIdx === -1) return new URLSearchParams();
  return new URLSearchParams(url.slice(hashIdx + 1));
}
