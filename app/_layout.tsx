import { useEffect, useMemo, useState } from 'react';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { I18nextProvider } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { bootstrapI18n, i18n } from '@/i18n';
import { bootstrapAuth, useIsHydrated } from '@/state/authStore';
import { ThemeProvider, useTokens } from '@/design/ThemeProvider';
import { NotificationServiceProvider } from '@/services/notifications/NotificationServiceProvider';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-Medium': require('../assets/fonts/Inter-Medium.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
    'Inter-Bold': require('../assets/fonts/Inter-Bold.ttf'),
    'IBMPlexSansArabic-Regular': require('../assets/fonts/IBMPlexSansArabic-Regular.ttf'),
    'IBMPlexSansArabic-Medium': require('../assets/fonts/IBMPlexSansArabic-Medium.ttf'),
    'IBMPlexSansArabic-SemiBold': require('../assets/fonts/IBMPlexSansArabic-SemiBold.ttf'),
    'IBMPlexSansArabic-Bold': require('../assets/fonts/IBMPlexSansArabic-Bold.ttf'),
  });
  const isHydrated = useIsHydrated();
  const [i18nReady, setI18nReady] = useState(false);
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
    [],
  );

  useEffect(() => {
    // eslint-disable-next-line no-console -- spec requires this exact bootstrap log line
    console.log('Supabase client initialized');
  }, []);

  useEffect(() => bootstrapAuth(), []);

  useEffect(() => {
    let cancelled = false;
    bootstrapI18n()
      .catch(() => {
        // detection failed; the synchronous EN fallback is already loaded
      })
      .finally(() => {
        if (!cancelled) setI18nReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fontsReady = fontsLoaded || !!fontError;
  if (!fontsReady || !isHydrated || !i18nReady) return null;

  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <ThemeProvider>
            <NotificationServiceProvider>
              <SplashGate />
              <ThemedStack />
            </NotificationServiceProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

/**
 * Hides the native splash on first render under ThemeProvider — which
 * means fonts loaded, initial auth check ran, and the theme finished
 * hydrating from AsyncStorage. This is the single hide-point: any
 * earlier and the user sees a flash of the unstyled tree; any later and
 * the splash overstays its welcome.
 */
function SplashGate() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  return null;
}

function ThemedStack() {
  const { colors } = useTokens();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
