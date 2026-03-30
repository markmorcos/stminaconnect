import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { colors } from "../../../src/theme/colors";
import { fontFamily, fontSize } from "../../../src/theme/typography";

export default function CheckInLayout() {
  const { t } = useTranslation();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.white,
        headerTitleStyle: {
          fontFamily: fontFamily.semiBold,
          fontSize: fontSize.h3,
        },
      }}
    >
      <Stack.Screen name="index" options={{ title: t("checkin.title") }} />
      <Stack.Screen name="[eventId]" options={{ title: "" }} />
    </Stack>
  );
}
