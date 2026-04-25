import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Banner } from 'react-native-paper';

import { Button, Stack, Text, useTokens } from '@/design';
import { useAuth } from '@/hooks/useAuth';
import { missingSupabaseEnvVars } from '@/services/api/supabase';

const SHOW_DEV_TOOLS = __DEV__ || process.env.EXPO_PUBLIC_SHOW_DEV_TOOLS === 'true';

export default function Home() {
  const { colors } = useTokens();
  const router = useRouter();
  const { servant, signOut, isLoading } = useAuth();
  const missingUrl = missingSupabaseEnvVars.includes('EXPO_PUBLIC_SUPABASE_URL');
  const greeting = servant?.display_name?.trim() || servant?.email || '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {missingUrl ? (
        <Banner visible icon="alert-circle">
          Supabase URL not configured. See README.
        </Banner>
      ) : null}
      <Stack
        flex={1}
        align="center"
        justify="center"
        padding="xl"
        gap="md"
        accessibilityLabel="St. Mina Connect home"
      >
        <Pressable
          onLongPress={() => {
            if (SHOW_DEV_TOOLS) router.push('/dev/showcase');
          }}
          delayLongPress={600}
          accessibilityRole="image"
          accessibilityLabel="St. Mina Connect logo"
        >
          <Text variant="displayMd" align="center">
            St. Mina Connect
          </Text>
        </Pressable>
        {greeting ? (
          <Text variant="bodyLg" color={colors.textMuted} align="center">
            Signed in as {greeting}
          </Text>
        ) : null}
        <Button variant="ghost" onPress={() => router.push('/about')}>
          About
        </Button>
        <Button
          variant="destructive"
          onPress={() => {
            void signOut();
          }}
          loading={isLoading}
          disabled={isLoading}
        >
          Sign out
        </Button>
      </Stack>
    </View>
  );
}
