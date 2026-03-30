import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

import { colors } from "../theme/colors";
import { fontFamily, fontSize } from "../theme/typography";
import { radius } from "../theme/radius";
import { spacing } from "../theme/spacing";
import { useSyncStore } from "../stores/syncStore";

export function SyncStatusBadge() {
  const { t } = useTranslation();
  const { status, pendingCount } = useSyncStore();

  const config = {
    synced: {
      icon: "✓",
      label: t("sync.synced"),
      bg: colors.presentBg,
      color: colors.present,
    },
    pending: {
      icon: "⏳",
      label: t("sync.pending", { count: pendingCount }),
      bg: colors.atRiskBg,
      color: colors.atRisk,
    },
    failed: {
      icon: "✗",
      label: t("sync.failed"),
      bg: colors.absentBg,
      color: colors.absent,
    },
  }[status];

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.icon, { color: config.color }]}>{config.icon}</Text>
      <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
  },
  icon: {
    fontSize: 12,
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.caption,
  },
});
