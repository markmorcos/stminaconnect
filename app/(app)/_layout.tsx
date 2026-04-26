import { View } from 'react-native';
import { Redirect, Stack } from 'expo-router';

import { NotificationBanner } from '@/components/NotificationBanner';
import { useTokens } from '@/design';
import { useAuthStore } from '@/state/authStore';

export default function AppLayout() {
  const session = useAuthStore((s) => s.session);
  const { colors } = useTokens();
  // Same reasoning as `(auth)/_layout.tsx` — gate on session only.
  if (!session) return <Redirect href="/sign-in" />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <NotificationBanner />
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </View>
  );
}
