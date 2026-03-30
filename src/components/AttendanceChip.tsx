import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

import { colors } from "../theme/colors";
import { fontFamily, fontSize } from "../theme/typography";
import { radius } from "../theme/radius";
import { spacing } from "../theme/spacing";

type AttendanceStatus = "present" | "absent" | "at_risk";

interface AttendanceChipProps {
  status: AttendanceStatus;
}

const chipConfig: Record<
  AttendanceStatus,
  { bg: string; color: string; icon: string; labelKey: string }
> = {
  present: {
    bg: colors.presentBg,
    color: colors.present,
    icon: "✓",
    labelKey: "checkin.markPresent",
  },
  absent: {
    bg: colors.absentBg,
    color: colors.absent,
    icon: "✗",
    labelKey: "checkin.markAbsent",
  },
  at_risk: {
    bg: colors.atRiskBg,
    color: colors.atRisk,
    icon: "⚠",
    labelKey: "home.atRisk",
  },
};

export function AttendanceChip({ status }: AttendanceChipProps) {
  const { t } = useTranslation();
  const config = chipConfig[status];

  return (
    <View style={[styles.chip, { backgroundColor: config.bg }]}>
      <Text style={[styles.icon, { color: config.color }]}>{config.icon}</Text>
      <Text style={[styles.label, { color: config.color }]}>
        {t(config.labelKey)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
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
