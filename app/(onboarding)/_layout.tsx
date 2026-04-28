import { Redirect, Stack } from 'expo-router';

import { useTokens } from '@/design';
import { useAuthStore } from '@/state/authStore';

/**
 * Onboarding stack — currently houses the GDPR consent screen. The
 * stack runs full-bleed without a header so the consent screen owns the
 * entire surface.
 *
 * Route guard: if the user has no session, redirect to sign-in. The
 * consent guard inside `(app)/_layout.tsx` is responsible for sending
 * an authenticated-but-not-consented user *here*; this guard only
 * handles the inverse — a user who lands here without a session.
 */
export default function OnboardingLayout() {
  const session = useAuthStore((s) => s.session);
  const { colors } = useTokens();

  if (!session) return <Redirect href="/sign-in" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
