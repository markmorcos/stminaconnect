import { StyleSheet, View } from 'react-native';
import { Banner, Surface, Text } from 'react-native-paper';

import { missingSupabaseEnvVars } from '@/services/api/supabase';

export default function Index() {
  const missingUrl = missingSupabaseEnvVars.includes('EXPO_PUBLIC_SUPABASE_URL');

  return (
    <View style={styles.root}>
      {missingUrl ? (
        <Banner visible icon="alert-circle">
          Supabase URL not configured. See README.
        </Banner>
      ) : null}
      <View style={styles.center}>
        <Surface style={styles.surface} elevation={1}>
          <Text variant="titleLarge">St. Mina Connect — initializing</Text>
        </Surface>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  surface: {
    padding: 24,
    borderRadius: 12,
  },
});
