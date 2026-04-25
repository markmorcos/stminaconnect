import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useTokens } from '@/design';
import { isRTLLanguage, useLanguage } from '@/design/useLanguage';

/**
 * Settings sub-stack — re-enables the native header (the parent
 * `(app)` stack hides it) and styles it from design tokens. Header
 * title font follows the active language so Arabic gets IBM Plex
 * Sans Arabic instead of Inter. Back-button and title alignment flip
 * automatically when `I18nManager.isRTL` is true.
 */
export default function SettingsLayout() {
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
      <Stack.Screen name="language" options={{ title: t('settings.language.title') }} />
    </Stack>
  );
}
