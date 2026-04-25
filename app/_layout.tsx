import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';

import '@/services/api/supabase';

export default function RootLayout() {
  useEffect(() => {
    // eslint-disable-next-line no-console -- spec requires this exact bootstrap log line
    console.log('Supabase client initialized');
  }, []);

  return (
    <PaperProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </PaperProvider>
  );
}
