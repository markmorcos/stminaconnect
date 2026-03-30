import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "../../../src/theme/colors";
import { fontFamily, fontSize, lineHeight } from "../../../src/theme/typography";
import { spacing } from "../../../src/theme/spacing";

export default function CheckInScreen() {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.content}>
        <Text style={styles.title}>{t("checkin.title")}</Text>
        <Text style={styles.placeholder}>{t("checkin.noEvents")}</Text>
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
  placeholder: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    lineHeight: lineHeight.body,
    color: colors.inkSecondary,
  },
});
