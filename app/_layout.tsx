import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

import '@/i18n';
import { bootstrapAuth, useIsHydrated } from '@/state/authStore';
import { ThemeProvider, useTokens } from '@/design/ThemeProvider';

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

  useEffect(() => {
    // eslint-disable-next-line no-console -- spec requires this exact bootstrap log line
    console.log('Supabase client initialized');
  }, []);

  useEffect(() => bootstrapAuth(), []);

  const fontsReady = fontsLoaded || !!fontError;
  if (!fontsReady || !isHydrated) return null;

  return (
    <ThemeProvider>
      <SplashGate />
      <ThemedStack />
    </ThemeProvider>
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
