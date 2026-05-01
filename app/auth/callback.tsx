import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';

import { Stack, Text, useTokens } from '@/design';
import { supabase } from '@/services/api/supabase';

type Status = 'pending' | 'done' | 'error';

/**
 * Wall-clock cap on the supabase auth round-trip. Without this, a
 * missing PKCE code-verifier (e.g. link tapped after reinstall) leaves
 * `exchangeCodeForSession` awaiting indefinitely on storage that will
 * never have the value, and the user sits on the spinner forever.
 */
const EXCHANGE_TIMEOUT_MS = 10_000;

/**
 * Handles the magic-link redirect. Two URL shapes can land here:
 *
 *   1. PKCE flow → `?code=…` query param. Exchanged via
 *      `exchangeCodeForSession`. This is the path `signInWithOtp` uses.
 *   2. Implicit flow (Supabase invite emails) → `#access_token=…&
 *      refresh_token=…&type=invite` in the URL fragment. Set directly
 *      via `setSession`.
 *
 * The screen also subscribes to live URL events: if the app is already
 * running when the user taps the email link, the OS pushes the URL
 * through the Linking listener rather than the cold-start
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
          const { error } = await withTimeout(
            supabase.auth.exchangeCodeForSession(code),
            EXCHANGE_TIMEOUT_MS,
          );
          if (error) throw error;
          if (!cancelled) setStatus('done');
        } else if (accessToken && refreshToken) {
          const { error } = await withTimeout(
            supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            }),
            EXCHANGE_TIMEOUT_MS,
          );
          if (error) throw error;
          if (!cancelled) setStatus('done');
        } else {
          // No auth payload reached us. On Android with custom URL
          // schemes the OS sometimes strips the URL path + fragment
          // when handing off, so the access_token never reaches the
          // app. Bail to sign-in immediately rather than spinning.
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

/**
 * Race a promise against a wall-clock timer. The timer is cleared on
 * resolve/reject so we don't leak a setTimeout into the next render.
 * On timeout the result rejects with a synthetic Error — `consume()`'s
 * try/catch maps that into the `error` status the same way as a real
 * GoTrue failure.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('auth callback timed out')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
