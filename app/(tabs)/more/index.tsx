import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "../../../src/theme/colors";
import { fontFamily, fontSize, lineHeight } from "../../../src/theme/typography";
import { spacing } from "../../../src/theme/spacing";
import { radius } from "../../../src/theme/radius";
import { supabase } from "../../../src/api/supabase";
import { useAuthStore } from "../../../src/stores/authStore";

interface MenuItem {
  labelKey: string;
  route?: string;
  adminOnly?: boolean;
  onPress?: () => void;
}

export default function MoreScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isAdmin } = useAuthStore();

  async function handleLogout() {
    Alert.alert(t("settings.logout"), "", [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("settings.logout"),
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  }

  const menuItems: MenuItem[] = [
    { labelKey: "followUp.title" },
    { labelKey: "settings.reports", adminOnly: true },
    { labelKey: "settings.title" },
    { labelKey: "settings.servants", adminOnly: true },
    { labelKey: "settings.alerts", adminOnly: true },
    { labelKey: "settings.privacy" },
    { labelKey: "settings.logout", onPress: handleLogout },
  ];

  const visibleItems = menuItems.filter(
    (item) => !item.adminOnly || isAdmin()
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.content}>
        <Text style={styles.title}>{t("tabs.more")}</Text>
        {visibleItems.map((item, index) => (
          <Pressable
            key={index}
            style={({ pressed }) => [
              styles.menuItem,
              pressed && styles.menuItemPressed,
              item.labelKey === "settings.logout" && styles.logoutItem,
            ]}
            onPress={item.onPress}
          >
            <Text
              style={[
                styles.menuItemText,
                item.labelKey === "settings.logout" && styles.logoutText,
              ]}
            >
              {t(item.labelKey)}
            </Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing[5],
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.h1,
    lineHeight: lineHeight.h1,
    color: colors.ink,
    marginBottom: spacing[4],
  },
  menuItem: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing[4],
    marginBottom: spacing[2],
  },
  menuItemPressed: {
    backgroundColor: colors.sandDark,
  },
  menuItemText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.body,
    lineHeight: lineHeight.body,
    color: colors.ink,
  },
  logoutItem: {
    marginTop: spacing[4],
    borderColor: colors.absent,
  },
  logoutText: {
    color: colors.absent,
  },
});
