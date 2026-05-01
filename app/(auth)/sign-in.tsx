import { useState } from 'react';
import { Controller, useForm, type FieldErrors, type Resolver } from 'react-hook-form';
import { Pressable, ScrollView, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';
import { z, type ZodSchema } from 'zod';

import { Button, Input, Snackbar, Stack, Text, useTokens } from '@/design';
import { useAuth } from '@/hooks/useAuth';

function buildSchema(t: ReturnType<typeof useTranslation>['t']) {
  return z.object({
    email: z.string().email(t('auth.signIn.errors.invalidEmail')),
  });
}

type MagicLinkValues = { email: string };

/**
 * Tiny Zod resolver — avoids pulling in `@hookform/resolvers` for a
 * single form. Matches the official adapter's shape closely enough that
 * the upgrade path is a one-line swap if more forms appear.
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
  const { signInWithMagicLink, isLoading, error } = useAuth();
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  async function sendLink(email: string) {
    const redirectTo = Linking.createURL('/auth/callback');
    await signInWithMagicLink(email, redirectTo);
    setPendingEmail(email);
    setSnack(t('auth.signIn.linkSentSnack'));
  }

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

        {pendingEmail === null ? (
          <MagicLinkForm
            disabled={isLoading}
            onSubmit={async (values) => {
              await sendLink(values.email.trim());
            }}
          />
        ) : (
          <CheckYourInbox
            email={pendingEmail}
            disabled={isLoading}
            onResend={async () => {
              await sendLink(pendingEmail);
            }}
            onUseDifferentEmail={() => setPendingEmail(null)}
          />
        )}
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

function MagicLinkForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (values: MagicLinkValues) => Promise<void>;
}) {
  const { t } = useTranslation();
  const schema = buildSchema(t);
  const { control, handleSubmit, formState } = useForm<MagicLinkValues>({
    defaultValues: { email: '' },
    resolver: zodResolver(schema),
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

function CheckYourInbox({
  email,
  disabled,
  onResend,
  onUseDifferentEmail,
}: {
  email: string;
  disabled: boolean;
  onResend: () => Promise<void>;
  onUseDifferentEmail: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTokens();
  return (
    <Stack gap="md">
      <Text variant="body" color={colors.textMuted}>
        {t('auth.signIn.checkYourInbox', { email })}
      </Text>
      <Pressable
        accessibilityRole="link"
        onPress={onResend}
        disabled={disabled}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text variant="body" color={colors.primary} align="center">
          {t('auth.signIn.resendLink')}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="link"
        onPress={onUseDifferentEmail}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text variant="body" color={colors.primary} align="center">
          {t('auth.signIn.useDifferentEmail')}
        </Text>
      </Pressable>
    </Stack>
  );
}
