import { Redirect, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useTokens } from '@/design';
import { isRTLLanguage, useLanguage } from '@/design/useLanguage';
import { useAuth } from '@/hooks/useAuth';

/**
 * Admin sub-stack — role-gated. Non-admin servants are redirected to
 * the home screen so the route is unreachable in the UI.
 *
 * The mirrored RPC checks (`is_admin()`-gated SECURITY DEFINER) are
 * the actual authority; this guard is UX, not security.
 */
export default function AdminLayout() {
  const { t } = useTranslation();
  const { colors } = useTokens();
  const { servant } = useAuth();
  const lang = useLanguage();
  const titleFontFamily = isRTLLanguage(lang) ? 'IBMPlexSansArabic-SemiBold' : 'Inter-SemiBold';

  if (!servant) return null;
  if (servant.role !== 'admin') return <Redirect href="/" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: titleFontFamily, fontSize: 18 },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="counted-events" options={{ title: t('admin.countedEvents.title') }} />
    </Stack>
  );
}
