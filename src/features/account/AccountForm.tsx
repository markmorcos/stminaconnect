/**
 * AccountForm — two sections: Display name (editable), Email (read-only).
 * Server-authoritative on display-name save: the auth-store servant is
 * replaced with whatever the RPC returned.
 */
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Controller,
  useForm,
  type FieldErrors,
  type Resolver,
  type ResolverResult,
} from 'react-hook-form';
import { z } from 'zod';

import { Button, Card, Input, Snackbar, Stack, Text, useTokens } from '@/design';
import { useAuth } from '@/hooks/useAuth';
import { i18n } from '@/i18n';
import { updateMyServant } from '@/services/api/account';

interface FormValues {
  display_name: string;
}

export const accountSchema = z.object({
  display_name: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(1, 'displayNameRequired').max(100, 'displayNameTooLong')),
});

function makeResolver(): Resolver<FormValues> {
  return async (values): Promise<ResolverResult<FormValues>> => {
    const result = accountSchema.safeParse(values);
    if (result.success) {
      return { values: { display_name: result.data.display_name }, errors: {} };
    }
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.length > 0 ? issue.path.join('.') : '_';
      const code = issue.message;
      const t = i18n.t.bind(i18n);
      const message =
        code === 'displayNameTooLong'
          ? t('settings.account.errors.displayNameTooLong')
          : t('settings.account.errors.displayNameRequired');
      errors[path] = { type: 'zod', message };
    }
    return { values: {} as Record<string, never>, errors: errors as FieldErrors<FormValues> };
  };
}

export function AccountForm() {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  const { servant, setServant } = useAuth();

  const initial = useMemo(
    () => ({ display_name: servant?.display_name?.trim() ?? '' }),
    [servant?.display_name],
  );

  const { control, handleSubmit, formState, watch, reset } = useForm<FormValues>({
    defaultValues: initial,
    resolver: makeResolver(),
  });

  useEffect(() => {
    reset(initial);
  }, [initial, reset]);

  const watched = watch('display_name');
  const dirty = watched.trim() !== (servant?.display_name?.trim() ?? '');

  const [submitting, setSubmitting] = useState(false);
  const [snack, setSnack] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  const onSave = handleSubmit(async (values) => {
    if (!servant) return;
    setSubmitting(true);
    try {
      const updated = await updateMyServant(values.display_name);
      setServant({ display_name: updated.display_name, updated_at: updated.updated_at });
      reset({ display_name: updated.display_name?.trim() ?? '' });
      setSnack({ message: t('settings.account.saved'), tone: 'success' });
    } catch {
      setSnack({ message: t('settings.account.errors.generic'), tone: 'error' });
    } finally {
      setSubmitting(false);
    }
  });

  const email = servant?.email ?? '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <Card padding="lg">
          <Stack gap="md">
            <Stack gap="xs">
              <Text variant="label" color={colors.textMuted}>
                {t('settings.account.displayNameLabel')}
              </Text>
              <Controller
                control={control}
                name="display_name"
                render={({ field }) => (
                  <Input
                    label={t('settings.account.displayNameLabel')}
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    autoCapitalize="words"
                    autoComplete="name"
                    error={formState.errors.display_name?.message}
                  />
                )}
              />
              <Button
                onPress={() => {
                  void onSave();
                }}
                loading={submitting}
                disabled={!dirty || submitting}
              >
                {t('settings.account.save')}
              </Button>
            </Stack>

            <Stack gap="xs">
              <Text variant="label" color={colors.textMuted}>
                {t('settings.account.emailLabel')}
              </Text>
              <Input
                label={t('settings.account.emailLabel')}
                value={email}
                editable={false}
                helper={t('settings.account.emailReadOnly')}
              />
            </Stack>
          </Stack>
        </Card>
      </ScrollView>

      <Snackbar visible={snack !== null} onDismiss={() => setSnack(null)} duration={4000}>
        {snack?.message ?? ''}
      </Snackbar>
    </View>
  );
}
