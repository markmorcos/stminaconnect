import { Text } from "react-native";
import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";

import { colors } from "../../src/theme/colors";
import { fontFamily, fontSize } from "../../src/theme/typography";
import { layout } from "../../src/theme/spacing";

// Simple text-based tab icons (will be replaced with Phosphor icons later)
function TabIcon({ name, color }: { name: string; color: string }) {
  const icons: Record<string, string> = {
    home: "⌂",
    checkin: "✓",
    people: "♟",
    more: "⋯",
  };
  return <Text style={{ fontSize: 22, color }}>{icons[name] || "•"}</Text>;
}

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkTertiary,
        tabBarLabelStyle: {
          fontFamily: fontFamily.medium,
          fontSize: fontSize.tabLabel,
        },
        tabBarStyle: {
          height: layout.tabBarHeight,
          paddingBottom: Platform.OS === "ios" ? 20 : 8,
          paddingTop: 8,
          borderTopColor: colors.border,
          backgroundColor: colors.white,
        },
        headerStyle: {
          backgroundColor: colors.primary,
        },
        headerTintColor: colors.white,
        headerTitleStyle: {
          fontFamily: fontFamily.semiBold,
          fontSize: fontSize.h3,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t("tabs.home"),
          tabBarLabel: t("tabs.home"),
          tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="checkin"
        options={{
          title: t("tabs.checkin"),
          tabBarLabel: t("tabs.checkin"),
          headerShown: false,
          tabBarIcon: ({ color }) => <TabIcon name="checkin" color={color} />,
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: t("tabs.people"),
          tabBarLabel: t("tabs.people"),
          headerShown: false,
          tabBarIcon: ({ color }) => <TabIcon name="people" color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t("tabs.more"),
          tabBarLabel: t("tabs.more"),
          headerShown: false,
          tabBarIcon: ({ color }) => <TabIcon name="more" color={color} />,
        }}
      />
    </Tabs>
  );
}
