import { useState } from 'react';
import { Controller, useForm, type FieldErrors, type Resolver } from 'react-hook-form';
import { Pressable, ScrollView, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';
import { z, type ZodSchema } from 'zod';

import { Button, Input, Snackbar, Stack, Text, useTokens } from '@/design';
import { useAuth } from '@/hooks/useAuth';

type Mode = 'password' | 'magic-link';

function buildSchemas(t: ReturnType<typeof useTranslation>['t']) {
  const passwordSchema = z.object({
    email: z.string().email(t('auth.signIn.errors.invalidEmail')),
    password: z.string().min(6, t('auth.signIn.errors.passwordTooShort')),
  });
  const magicLinkSchema = z.object({
    email: z.string().email(t('auth.signIn.errors.invalidEmail')),
  });
  const otpSchema = z.object({
    token: z
      .string()
      .min(6, t('auth.signIn.errors.codeLength'))
      .max(6, t('auth.signIn.errors.codeLength'))
      .regex(/^\d+$/, t('auth.signIn.errors.codeDigitsOnly')),
  });
  return { passwordSchema, magicLinkSchema, otpSchema };
}

type PasswordValues = { email: string; password: string };
type MagicLinkValues = { email: string };
type OtpValues = { token: string };

/**
 * Tiny Zod resolver — avoids pulling in `@hookform/resolvers` for two
 * forms. Mirrors the official adapter's shape closely enough that the
 * upgrade path is a one-line swap when more forms appear.
 */
function zodResolver<T extends Record<string, unknown>>(schema: ZodSchema<T>): Resolver<T> {
  return async (values) => {
    const result = schema.safeParse(values);
    if (result.success) {
      return { values: result.data, errors: {} };
    }
    const errors = result.error.issues.reduce<Record<string, { type: string; message: string }>>(
      (acc, issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : '_';
        acc[path] = { type: 'zod', message: issue.message };
        return acc;
      },
      {},
    );
    return { values: {}, errors: errors as FieldErrors<T> };
  };
}

export default function SignInScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  const { signIn, signInWithMagicLink, verifyEmailOtp, isLoading, error } = useAuth();
  const [mode, setMode] = useState<Mode>('password');
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.xl,
          paddingTop: spacing['2xl'],
          gap: spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Stack gap="sm">
          <Text variant="displayMd" accessibilityRole="header">
            {t('auth.signIn.welcome')}
          </Text>
          <Text variant="bodyLg" color={colors.textMuted}>
            {t('auth.signIn.subtitle')}
          </Text>
        </Stack>

        {mode === 'password' ? (
          <PasswordModeForm
            disabled={isLoading}
            onSubmit={async (values) => {
              await signIn(values.email.trim(), values.password);
            }}
          />
        ) : pendingEmail === null ? (
          <MagicLinkModeForm
            disabled={isLoading}
            onSubmit={async (values) => {
              // Production standalone builds with the `stminaconnect://`
              // scheme can tap the magic-link URL in the email. Expo Go
              // ignores it and follows the 6-digit OTP path below — the
              // local GoTrue silently rejects `exp://` redirects.
              const redirectTo = Linking.createURL('/auth/callback');
              await signInWithMagicLink(values.email.trim(), redirectTo);
              setPendingEmail(values.email.trim());
              setSnack(t('auth.signIn.codeSentSnack'));
            }}
          />
        ) : (
          <OtpModeForm
            email={pendingEmail}
            disabled={isLoading}
            onSubmit={async (values) => {
              await verifyEmailOtp(pendingEmail, values.token);
            }}
            onBack={() => setPendingEmail(null)}
          />
        )}

        {pendingEmail === null ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => setMode((m) => (m === 'password' ? 'magic-link' : 'password'))}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text variant="body" color={colors.primary} align="center">
              {mode === 'password'
                ? t('auth.signIn.switchToMagicLink')
                : t('auth.signIn.switchToPassword')}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <Snackbar
        visible={Boolean(error)}
        onDismiss={() => {
          /* error clears on next action */
        }}
        duration={4000}
      >
        {error ?? ''}
      </Snackbar>
      <Snackbar visible={Boolean(snack)} onDismiss={() => setSnack(null)} duration={4000}>
        {snack ?? ''}
      </Snackbar>
    </View>
  );
}

function PasswordModeForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (values: PasswordValues) => Promise<void>;
}) {
  const { t } = useTranslation();
  const { passwordSchema } = buildSchemas(t);
  const { control, handleSubmit, formState } = useForm<PasswordValues>({
    defaultValues: { email: '', password: '' },
    resolver: zodResolver(passwordSchema),
  });
  return (
    <Stack gap="md">
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <Input
            label={t('auth.signIn.emailLabel')}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={formState.errors.email?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <Input
            label={t('auth.signIn.passwordLabel')}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={formState.errors.password?.message}
          />
        )}
      />
      <Button
        onPress={handleSubmit(onSubmit)}
        loading={disabled || formState.isSubmitting}
        disabled={disabled || formState.isSubmitting}
      >
        {t('auth.signIn.submitPassword')}
      </Button>
    </Stack>
  );
}

function MagicLinkModeForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (values: MagicLinkValues) => Promise<void>;
}) {
  const { t } = useTranslation();
  const { magicLinkSchema } = buildSchemas(t);
  const { control, handleSubmit, formState } = useForm<MagicLinkValues>({
    defaultValues: { email: '' },
    resolver: zodResolver(magicLinkSchema),
  });
  return (
    <Stack gap="md">
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <Input
            label={t('auth.signIn.emailLabel')}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={formState.errors.email?.message}
          />
        )}
      />
      <Button
        onPress={handleSubmit(onSubmit)}
        loading={disabled || formState.isSubmitting}
        disabled={disabled || formState.isSubmitting}
      >
        {t('auth.signIn.submitMagicLink')}
      </Button>
    </Stack>
  );
}

function OtpModeForm({
  email,
  disabled,
  onSubmit,
  onBack,
}: {
  email: string;
  disabled: boolean;
  onSubmit: (values: OtpValues) => Promise<void>;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const { otpSchema } = buildSchemas(t);
  const { colors } = useTokens();
  const { control, handleSubmit, formState } = useForm<OtpValues>({
    defaultValues: { token: '' },
    resolver: zodResolver(otpSchema),
  });
  return (
    <Stack gap="md">
      <Text variant="body" color={colors.textMuted}>
        {t('auth.signIn.otpInstruction', { email })}
      </Text>
      <Controller
        control={control}
        name="token"
        render={({ field }) => (
          <Input
            label={t('auth.signIn.otpLabel')}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={6}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={formState.errors.token?.message}
          />
        )}
      />
      <Button
        onPress={handleSubmit(onSubmit)}
        loading={disabled || formState.isSubmitting}
        disabled={disabled || formState.isSubmitting}
      >
        {t('auth.signIn.submitOtp')}
      </Button>
      <Pressable
        accessibilityRole="link"
        onPress={onBack}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text variant="body" color={colors.primary} align="center">
          {t('auth.signIn.useDifferentEmail')}
        </Text>
      </Pressable>
    </Stack>
  );
}
