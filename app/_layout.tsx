import { useEffect, useState } from "react";
import { I18nManager } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import {
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
} from "@expo-google-fonts/cairo";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";

import i18n, { getSavedLanguage } from "../src/i18n";
import { useAuthStore } from "../src/stores/authStore";
import { supabase } from "../src/api/supabase";

export { ErrorBoundary } from "expo-router";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

const ONBOARDING_KEY = "stmina_onboarding_complete";

function AuthGate({ children }: { children: React.ReactNode }) {
  const segments = useSegments();
  const router = useRouter();
  const { session, isLoading, hasCompletedOnboarding } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!hasCompletedOnboarding && !inAuthGroup) {
      router.replace("/(auth)/onboarding");
    } else if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      router.replace("/(tabs)/home");
    }
  }, [session, isLoading, hasCompletedOnboarding, segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Cairo_400Regular,
    Cairo_500Medium,
    Cairo_600SemiBold,
    Cairo_700Bold,
  });

  const { setSession, setProfile, setLoading, setHasCompletedOnboarding } =
    useAuthStore();
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    async function init() {
      // Load saved language
      const savedLang = await getSavedLanguage();
      if (savedLang) {
        await i18n.changeLanguage(savedLang);
        const isRTL = savedLang === "ar";
        if (I18nManager.isRTL !== isRTL) {
          I18nManager.forceRTL(isRTL);
        }
      }

      // Check onboarding status
      const onboardingDone = await AsyncStorage.getItem(ONBOARDING_KEY);
      setHasCompletedOnboarding(onboardingDone === "true");

      // Listen for auth state changes
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (_event, session) => {
        setSession(session);

        if (session?.user) {
          // Fetch servant profile
          const { data } = await supabase
            .from("servants")
            .select("*")
            .eq("id", session.user.id)
            .single();

          if (data) {
            setProfile({
              id: data.id,
              firstName: data.first_name,
              lastName: data.last_name,
              phone: data.phone,
              email: data.email,
              role: data.role,
              regions: data.regions || [],
              preferredLanguage: data.preferred_language,
            });
          }
        } else {
          setProfile(null);
        }

        setLoading(false);
      });

      setAppReady(true);

      return () => {
        subscription.unsubscribe();
      };
    }

    init();
  }, []);

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  useEffect(() => {
    if (fontsLoaded && appReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, appReady]);

  if (!fontsLoaded || !appReady) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <AuthGate>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="+not-found" />
          </Stack>
        </AuthGate>
        <StatusBar style="auto" />
      </I18nextProvider>
    </QueryClientProvider>
  );
}
