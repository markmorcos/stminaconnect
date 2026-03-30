import { Link, Stack } from "expo-router";
import { View, Text, StyleSheet } from "react-native";

import { colors } from "../src/theme/colors";
import { fontFamily, fontSize, lineHeight } from "../src/theme/typography";
import { spacing } from "../src/theme/spacing";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn't exist.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to home screen!</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[5],
    backgroundColor: colors.background,
  },
  title: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.h2,
    lineHeight: lineHeight.h2,
    color: colors.ink,
  },
  link: {
    marginTop: spacing[4],
    paddingVertical: spacing[4],
  },
  linkText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.body,
    color: colors.primary,
  },
});
