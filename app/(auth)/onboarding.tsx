import { useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Dimensions,
  Pressable,
  StyleSheet,
  ViewToken,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";

import { colors } from "../../src/theme/colors";
import { fontFamily, fontSize, lineHeight } from "../../src/theme/typography";
import { spacing } from "../../src/theme/spacing";
import { useAuthStore } from "../../src/stores/authStore";

const { width } = Dimensions.get("window");
const ONBOARDING_KEY = "stmina_onboarding_complete";

interface OnboardingSlide {
  key: string;
  titleKey: string;
  bodyKey: string;
  icon: string;
}

const slides: OnboardingSlide[] = [
  {
    key: "1",
    titleKey: "onboarding.screen1Title",
    bodyKey: "onboarding.screen1Body",
    icon: "✝",
  },
  {
    key: "2",
    titleKey: "onboarding.screen2Title",
    bodyKey: "onboarding.screen2Body",
    icon: "✓",
  },
  {
    key: "3",
    titleKey: "onboarding.screen3Title",
    bodyKey: "onboarding.screen3Body",
    icon: "🔔",
  },
];

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { setHasCompletedOnboarding } = useAuthStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  async function handleGetStarted() {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    setHasCompletedOnboarding(true);
    router.replace("/(auth)/login");
  }

  function handleNext() {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      handleGetStarted();
    }
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <Text style={styles.icon}>{item.icon}</Text>
            <Text style={styles.title}>{t(item.titleKey)}</Text>
            <Text style={styles.body}>{t(item.bodyKey)}</Text>
          </View>
        )}
      />

      {/* Pagination dots */}
      <View style={styles.pagination}>
        {slides.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === currentIndex ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>

      {/* Button */}
      <View style={styles.buttonContainer}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleNext}
        >
          <Text style={styles.buttonText}>
            {currentIndex === slides.length - 1
              ? t("onboarding.getStarted")
              : t("common.next")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  slide: {
    width,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing[8],
  },
  icon: {
    fontSize: 64,
    marginBottom: spacing[6],
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.h1,
    lineHeight: lineHeight.h1,
    color: colors.white,
    textAlign: "center",
    marginBottom: spacing[3],
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.bodyLarge,
    lineHeight: lineHeight.bodyLarge,
    color: colors.sandDark,
    textAlign: "center",
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing[2],
    marginBottom: spacing[8],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: colors.gold,
    width: 24,
  },
  dotInactive: {
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  buttonContainer: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[12],
  },
  button: {
    backgroundColor: colors.gold,
    height: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonPressed: {
    backgroundColor: colors.goldDark,
  },
  buttonText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.button,
    lineHeight: lineHeight.button,
    color: colors.white,
  },
});
