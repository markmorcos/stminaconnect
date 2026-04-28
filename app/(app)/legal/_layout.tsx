import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useTokens } from '@/design';
import { isRTLLanguage } from '@/design/useLanguage';

export default function LegalLayout() {
  const { t, i18n } = useTranslation();
  const { colors } = useTokens();
  const titleFontFamily = isRTLLanguage(i18n.language)
    ? 'IBMPlexSansArabic-SemiBold'
    : 'Inter-SemiBold';
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: titleFontFamily, fontSize: 18 },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="privacy" options={{ title: t('settings.privacy.viewPolicy') }} />
      <Stack.Screen name="terms" options={{ title: t('settings.privacy.viewTerms') }} />
    </Stack>
  );
}
