import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { colors } from "../../../src/theme/colors";
import { fontFamily, fontSize } from "../../../src/theme/typography";

export default function PeopleLayout() {
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
      <Stack.Screen name="index" options={{ title: t("people.title") }} />
      <Stack.Screen name="quick-add" options={{ title: t("people.quickAdd") }} />
      <Stack.Screen name="register" options={{ title: t("people.register") }} />
      <Stack.Screen name="[personId]" options={{ title: "" }} />
    </Stack>
  );
}
