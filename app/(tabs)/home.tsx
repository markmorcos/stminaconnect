import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "../../src/theme/colors";
import { fontFamily, fontSize, lineHeight } from "../../src/theme/typography";
import { spacing } from "../../src/theme/spacing";
import { useAuthStore } from "../../src/stores/authStore";

export default function HomeScreen() {
  const { t } = useTranslation();
  const { profile } = useAuthStore();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.greeting}>
          {profile
            ? `${t("tabs.home")} — ${profile.firstName}`
            : t("tabs.home")}
        </Text>
        <Text style={styles.subtitle}>{t("auth.tagline")}</Text>

        {/* Placeholder cards - will be built in Phase 5 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("home.myGroup")}</Text>
          <Text style={styles.cardBody}>—</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("home.pendingFollowUps")}</Text>
          <Text style={styles.cardBody}>—</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("home.recentNewcomers")}</Text>
          <Text style={styles.cardBody}>—</Text>
        </View>
      </ScrollView>
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
  greeting: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.h1,
    lineHeight: lineHeight.h1,
    color: colors.ink,
    marginBottom: spacing[1],
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    lineHeight: lineHeight.body,
    color: colors.inkSecondary,
    marginBottom: spacing[6],
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  cardTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.h3,
    lineHeight: lineHeight.h3,
    color: colors.ink,
    marginBottom: spacing[2],
  },
  cardBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    lineHeight: lineHeight.body,
    color: colors.inkSecondary,
  },
});
