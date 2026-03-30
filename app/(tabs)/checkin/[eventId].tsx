import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { colors } from "../../../src/theme/colors";
import { fontFamily, fontSize, lineHeight } from "../../../src/theme/typography";
import { spacing } from "../../../src/theme/spacing";

export default function EventCheckInScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Event: {eventId}</Text>
      <Text style={styles.subtext}>Attendance check-in will be built in Phase 3.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing[5],
  },
  text: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.h2,
    lineHeight: lineHeight.h2,
    color: colors.ink,
    marginBottom: spacing[2],
  },
  subtext: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.inkSecondary,
  },
});
