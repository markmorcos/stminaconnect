import { useEffect, useState } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
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
 * Hard ceiling for the whole screen — covers the case where neither
 * `Linking.getInitialURL()` nor `addEventListener('url')` ever delivers
 * a URL (cold-start race: expo-router consumed the initial URL for
 * routing before this screen's listener was attached, so the URL
 * fell on the floor and `exchangeCodeForSession` was never called,
 * meaning the per-call timeout never started either).
 */
const SCREEN_TIMEOUT_MS = 12_000;

/**
 * Handles the magic-link redirect. Three URL shapes can land here:
 *
 *   1. PKCE flow → `?code=…` query param. Exchanged via
 *      `exchangeCodeForSession`. This is the path `signInWithOtp` uses
 *      under `flowType: 'pkce'`.
 *   2. Implicit flow (legacy / Supabase invite emails) →
 *      `#access_token=…&refresh_token=…&type=invite` in the URL
 *      fragment. Set directly via `setSession`.
 *   3. Error from Supabase verify (expired/used token) → `?error=…`
 *      in the query string. No code, no fragment — falls through to the
 *      synchronous `error` status and redirects to /sign-in.
 *
 * URL delivery: we read `code` from expo-router's `useLocalSearchParams`
 * first because that survives the cold-start race where
 * `Linking.getInitialURL()` returns null after expo-router has already
 * consumed the URL for routing. The Linking APIs are still wired up for
 * warm-start (app already running when the link is tapped) and for the
 * fragment-based path that expo-router doesn't surface in params.
 */
export default function AuthCallback() {
  const { t } = useTranslation();
  const { colors } = useTokens();
  const [status, setStatus] = useState<Status>('pending');
  const params = useLocalSearchParams<{ code?: string }>();
  const codeFromParams = typeof params.code === 'string' ? params.code : null;

  useEffect(() => {
    let cancelled = false;

    async function exchangeWithCode(code: string): Promise<void> {
      try {
        const { error } = await withTimeout(
          supabase.auth.exchangeCodeForSession(code),
          EXCHANGE_TIMEOUT_MS,
        );
        if (error) throw error;
        if (!cancelled) setStatus('done');
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    async function consumeUrl(url: string | null): Promise<void> {
      if (!url || cancelled) return;
      try {
        const parsed = Linking.parse(url);
        const code = typeof parsed.queryParams?.code === 'string' ? parsed.queryParams.code : null;
        const fragment = extractFragment(url);
        const accessToken = fragment.get('access_token');
        const refreshToken = fragment.get('refresh_token');

        if (code) {
          await exchangeWithCode(code);
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
          // Most likely an `?error=…` from Supabase verify (expired or
          // already-used token). No code, no fragment → bail to sign-in.
          if (!cancelled) setStatus('error');
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    // 1. Cold-start path: expo-router has already routed us with the
    //    code as a query param. Use it directly so we don't depend on
    //    `Linking.getInitialURL` (which races with the router on
    //    cold-start and can return null).
    if (codeFromParams) {
      void exchangeWithCode(codeFromParams);
    } else {
      // 2. Cold-start fallback: try the raw URL for the fragment-based
      //    implicit flow that doesn't surface in router params.
      void Linking.getInitialURL().then((url) => consumeUrl(url));
    }

    // 3. Warm-start: the OS pushes the URL through the Linking listener
    //    when the app is already running.
    const sub = Linking.addEventListener('url', ({ url }) => {
      void consumeUrl(url);
    });

    // 4. Hard screen-level deadline. Belt-and-braces: even if every
    //    URL-delivery mechanism above failed silently, the screen
    //    refuses to spin past SCREEN_TIMEOUT_MS.
    const screenTimer = setTimeout(() => {
      if (!cancelled) setStatus((prev) => (prev === 'pending' ? 'error' : prev));
    }, SCREEN_TIMEOUT_MS);

    return () => {
      cancelled = true;
      sub.remove();
      clearTimeout(screenTimer);
    };
  }, [codeFromParams]);

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
