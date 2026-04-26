import { View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTokens } from '@/design';
import { useAuthStore } from '@/state/authStore';

export default function AuthLayout() {
  const session = useAuthStore((s) => s.session);
  const insets = useSafeAreaInsets();
  const { colors } = useTokens();
  // No isLoading gate here: an in-flight action would otherwise unmount
  // the sign-in screen and lose its local form state. App-level hydration
  // is already handled by the root layout, so by the time we get here
  // `session` is authoritative.
  if (session) return <Redirect href="/" />;
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
