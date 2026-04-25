import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Banner } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import { Button, Stack, Text, useTokens } from '@/design';
import { useAuth } from '@/hooks/useAuth';
import { missingSupabaseEnvVars } from '@/services/api/supabase';

const SHOW_DEV_TOOLS = __DEV__ || process.env.EXPO_PUBLIC_SHOW_DEV_TOOLS === 'true';

export default function Home() {
  const { t } = useTranslation();
  const { colors } = useTokens();
  const router = useRouter();
  const { servant, signOut, isLoading } = useAuth();
  const missingUrl = missingSupabaseEnvVars.includes('EXPO_PUBLIC_SUPABASE_URL');
  const greeting = servant?.display_name?.trim() || servant?.email || '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {missingUrl ? (
        <Banner visible icon="alert-circle">
          {t('home.supabaseMissing')}
        </Banner>
      ) : null}
      <Stack
        flex={1}
        align="center"
        justify="center"
        padding="xl"
        gap="md"
        accessibilityLabel={t('home.title')}
      >
        <Pressable
          onLongPress={() => {
            if (SHOW_DEV_TOOLS) router.push('/dev/showcase');
          }}
          delayLongPress={600}
          accessibilityRole="image"
          accessibilityLabel={t('home.title')}
        >
          <Text variant="displayMd" align="center">
            {t('home.title')}
          </Text>
        </Pressable>
        {greeting ? (
          <Text variant="bodyLg" color={colors.textMuted} align="center">
            {t('home.signedInAs', { name: greeting })}
          </Text>
        ) : null}
        <Button variant="ghost" onPress={() => router.push('/about')}>
          {t('home.about')}
        </Button>
        <Button variant="ghost" onPress={() => router.push('/settings/language')}>
          {t('home.settings')}
        </Button>
        <Button
          variant="destructive"
          onPress={() => {
            void signOut();
          }}
          loading={isLoading}
          disabled={isLoading}
        >
          {t('home.signOut')}
        </Button>
      </Stack>
    </View>
  );
}
