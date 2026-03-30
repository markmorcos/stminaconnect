import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from "react-native";
import * as Haptics from "expo-haptics";

import { colors } from "../theme/colors";
import { fontFamily, fontSize, lineHeight } from "../theme/typography";
import { radius } from "../theme/radius";
import { layout } from "../theme/spacing";

type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }

  const isDisabled = disabled || loading;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant].container,
        pressed && !isDisabled && variantStyles[variant].pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={handlePress}
      disabled={isDisabled}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "secondary" || variant === "ghost" ? colors.primary : colors.white}
          size="small"
        />
      ) : (
        <Text style={[styles.text, variantStyles[variant].text]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: layout.buttonHeight,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  disabled: {
    opacity: 0.4,
  },
  text: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.button,
    lineHeight: lineHeight.button,
  },
});

const variantStyles: Record<ButtonVariant, {
  container: ViewStyle;
  pressed: ViewStyle;
  text: TextStyle;
}> = {
  primary: {
    container: { backgroundColor: colors.primary },
    pressed: { backgroundColor: colors.primaryLight },
    text: { color: colors.white },
  },
  secondary: {
    container: {
      backgroundColor: "transparent",
      borderWidth: 2,
      borderColor: colors.primary,
    },
    pressed: { backgroundColor: colors.sandDark },
    text: { color: colors.primary },
  },
  destructive: {
    container: { backgroundColor: colors.absent },
    pressed: { backgroundColor: "#A62F24" },
    text: { color: colors.white },
  },
  ghost: {
    container: { backgroundColor: "transparent" },
    pressed: { backgroundColor: colors.sandDark },
    text: { color: colors.primary },
  },
};
