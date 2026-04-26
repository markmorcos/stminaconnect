import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useTokens } from '@/design';
import { isRTLLanguage, useLanguage } from '@/design/useLanguage';

export default function RegistrationLayout() {
  const { t } = useTranslation();
  const { colors } = useTokens();
  const lang = useLanguage();
  const titleFontFamily = isRTLLanguage(lang) ? 'IBMPlexSansArabic-SemiBold' : 'Inter-SemiBold';
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: titleFontFamily, fontSize: 18 },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="quick-add" options={{ title: t('registration.quickAdd.title') }} />
    </Stack>
  );
}
