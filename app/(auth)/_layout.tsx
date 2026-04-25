import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/state/authStore';

export default function AuthLayout() {
  const session = useAuthStore((s) => s.session);
  // No isLoading gate here: an in-flight action would otherwise unmount
  // the sign-in screen and lose its local form state. App-level hydration
  // is already handled by the root layout, so by the time we get here
  // `session` is authoritative.
  if (session) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
