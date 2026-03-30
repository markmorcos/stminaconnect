import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useTranslation } from "react-i18next";

import { colors } from "../../src/theme/colors";
import { fontFamily, fontSize, lineHeight } from "../../src/theme/typography";
import { spacing } from "../../src/theme/spacing";
import { radius } from "../../src/theme/radius";
import { supabase } from "../../src/api/supabase";

type Step = "phone" | "otp";

export default function LoginScreen() {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("+49");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSendCode() {
    if (phone.length < 8) {
      Alert.alert(t("common.error"), t("auth.invalidPhone"));
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    setLoading(false);

    if (error) {
      Alert.alert(t("common.error"), error.message);
    } else {
      setStep("otp");
    }
  }

  async function handleVerify() {
    if (otp.length !== 6) {
      Alert.alert(t("common.error"), t("auth.invalidOtp"));
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: "sms",
    });
    setLoading(false);

    if (error) {
      Alert.alert(t("common.error"), error.message);
    }
    // On success, onAuthStateChange in _layout.tsx handles navigation
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.header}>
        <Text style={styles.crossIcon}>✝</Text>
        <Text style={styles.welcomeText}>{t("auth.welcome")}</Text>
        <Text style={styles.appName}>{t("auth.appName")}</Text>
        <Text style={styles.tagline}>{t("auth.tagline")}</Text>
      </View>

      <View style={styles.form}>
        {step === "phone" ? (
          <>
            <Text style={styles.label}>{t("auth.phoneLabel")}</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder={t("auth.phonePlaceholder")}
              placeholderTextColor={colors.inkTertiary}
              keyboardType="phone-pad"
              autoComplete="tel"
              autoFocus
            />
            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
              onPress={handleSendCode}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? t("common.loading") : t("auth.sendCode")}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.label}>{t("auth.otpLabel")}</Text>
            <TextInput
              style={styles.input}
              value={otp}
              onChangeText={setOtp}
              placeholder={t("auth.otpPlaceholder")}
              placeholderTextColor={colors.inkTertiary}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
              onPress={handleVerify}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? t("common.loading") : t("auth.verify")}
              </Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                setStep("phone");
                setOtp("");
              }}
            >
              <Text style={styles.secondaryButtonText}>
                {t("auth.resendCode")}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: spacing[10],
  },
  crossIcon: {
    fontSize: 48,
    color: colors.gold,
    marginBottom: spacing[4],
  },
  welcomeText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.bodyLarge,
    lineHeight: lineHeight.bodyLarge,
    color: colors.sandDark,
  },
  appName: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.display,
    lineHeight: lineHeight.display,
    color: colors.white,
    marginBottom: spacing[1],
  },
  tagline: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    lineHeight: lineHeight.body,
    color: colors.gold,
  },
  form: {
    paddingHorizontal: spacing[5],
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.bodySmall,
    lineHeight: lineHeight.bodySmall,
    color: colors.sandDark,
    marginBottom: spacing[2],
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: radius.md,
    height: 52,
    paddingHorizontal: spacing[4],
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.white,
    marginBottom: spacing[4],
  },
  button: {
    backgroundColor: colors.gold,
    height: 52,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonPressed: {
    backgroundColor: colors.goldDark,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.button,
    lineHeight: lineHeight.button,
    color: colors.white,
  },
  secondaryButton: {
    marginTop: spacing[4],
    alignItems: "center",
    paddingVertical: spacing[3],
  },
  secondaryButtonText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.body,
    lineHeight: lineHeight.body,
    color: colors.gold,
  },
});
