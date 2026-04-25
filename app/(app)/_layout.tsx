import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/state/authStore';

export default function AppLayout() {
  const session = useAuthStore((s) => s.session);
  // Same reasoning as `(auth)/_layout.tsx` — gate on session only.
  if (!session) return <Redirect href="/sign-in" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
