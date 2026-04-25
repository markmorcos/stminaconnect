import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Banner } from 'react-native-paper';

import { Stack, Text, useTokens } from '@/design';
import { missingSupabaseEnvVars } from '@/services/api/supabase';

const SHOW_DEV_TOOLS = __DEV__ || process.env.EXPO_PUBLIC_SHOW_DEV_TOOLS === 'true';

export default function Index() {
  const { colors, spacing } = useTokens();
  const router = useRouter();
  const missingUrl = missingSupabaseEnvVars.includes('EXPO_PUBLIC_SUPABASE_URL');

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
        <Text variant="bodyLg" color={colors.textMuted} align="center">
          Initializing
        </Text>
      </Stack>
    </View>
  );
}
