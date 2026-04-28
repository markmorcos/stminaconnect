import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName, useTokens } from '@/design';
import { isRTLLanguage, useLanguage } from '@/design/useLanguage';

const TAB_ICON: Record<'index' | 'persons' | 'follow-ups' | 'settings', IconName> = {
  index: 'home',
  persons: 'users',
  'follow-ups': 'messageCircle',
  settings: 'settings',
};

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  const insets = useSafeAreaInsets();
  const lang = useLanguage();
  const labelFont = isRTLLanguage(lang) ? 'IBMPlexSansArabic-Medium' : 'Inter-Medium';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        // With Android `edgeToEdgeEnabled`, the gesture/nav bar overlays
        // content. Explicitly reserve `insets.bottom` (and a minimum
        // breathing margin) below the labels so the tab strip doesn't
        // hug the gesture pill. iOS already pads via the home indicator
        // inset; using the same value here keeps both platforms aligned.
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom + spacing.xs,
          height: 56 + insets.bottom,
        },
        tabBarLabelStyle: {
          fontFamily: labelFont,
          fontSize: 11,
          marginBottom: spacing.xs,
        },
        tabBarIconStyle: {
          marginTop: spacing.xs,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, size }) => <Icon name={TAB_ICON.index} color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="persons"
        options={{
          title: t('tabs.persons'),
          tabBarIcon: ({ color, size }) => (
            <Icon name={TAB_ICON.persons} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="follow-ups"
        options={{
          title: t('tabs.followUps'),
          tabBarIcon: ({ color, size }) => (
            <Icon name={TAB_ICON['follow-ups']} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => (
            <Icon name={TAB_ICON.settings} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
