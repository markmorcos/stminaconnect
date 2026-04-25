import { useState } from 'react';
import { Controller, useForm, type FieldErrors, type Resolver } from 'react-hook-form';
import { Pressable, ScrollView, View } from 'react-native';
import * as Linking from 'expo-linking';
import { z, type ZodSchema } from 'zod';

import { Button, Input, Snackbar, Stack, Text, useTokens } from '@/design';
import { useAuth } from '@/hooks/useAuth';

type Mode = 'password' | 'magic-link';

const passwordSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password is too short'),
});
type PasswordValues = z.infer<typeof passwordSchema>;

const magicLinkSchema = z.object({
  email: z.string().email('Enter a valid email'),
});
type MagicLinkValues = z.infer<typeof magicLinkSchema>;

const otpSchema = z.object({
  token: z
    .string()
    .min(6, 'Code must be 6 digits')
    .max(6, 'Code must be 6 digits')
    .regex(/^\d+$/, 'Digits only'),
});
type OtpValues = z.infer<typeof otpSchema>;

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
            Welcome
          </Text>
          <Text variant="bodyLg" color={colors.textMuted}>
            Servants only. Use your church-issued email.
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
              setSnack('Code sent. Check your email (or Mailpit in dev).');
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
              {mode === 'password' ? 'Email me a code instead' : 'Use email and password instead'}
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
            label="Email"
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
            label="Password"
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
        Sign in
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
            label="Email"
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
        Send code
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
  const { colors } = useTokens();
  const { control, handleSubmit, formState } = useForm<OtpValues>({
    defaultValues: { token: '' },
    resolver: zodResolver(otpSchema),
  });
  return (
    <Stack gap="md">
      <Text variant="body" color={colors.textMuted}>
        We sent a 6-digit code to{' '}
        <Text variant="body" style={{ fontWeight: '600' }} color={colors.text}>
          {email}
        </Text>
        . Enter it below to sign in.
      </Text>
      <Controller
        control={control}
        name="token"
        render={({ field }) => (
          <Input
            label="6-digit code"
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
        Verify
      </Button>
      <Pressable
        accessibilityRole="link"
        onPress={onBack}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text variant="body" color={colors.primary} align="center">
          Use a different email
        </Text>
      </Pressable>
    </Stack>
  );
}
