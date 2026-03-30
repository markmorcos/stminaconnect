import { View, StyleSheet, ViewStyle } from "react-native";

import { colors } from "../theme/colors";
import { radius } from "../theme/radius";
import { spacing } from "../theme/spacing";
import { shadows } from "../theme/shadows";

interface CardProps {
  children: React.ReactNode;
  accentColor?: string;
  style?: ViewStyle;
}

export function Card({ children, accentColor, style }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        accentColor && { borderStartWidth: 4, borderStartColor: accentColor },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing[4],
  },
});
