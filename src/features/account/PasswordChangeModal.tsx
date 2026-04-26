/**
 * PasswordChangeModal — three-field modal: current, new, confirm.
 * Submit pipeline: re-verify current password via signInWithPassword,
 * then call updateUser({ password: new }). The session returned by the
 * verify call is discarded — the user keeps their active session.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Controller,
  useForm,
  type FieldErrors,
  type Resolver,
  type ResolverResult,
} from 'react-hook-form';
import { z } from 'zod';

import { Button, Input, Modal, Stack, Text, useTokens } from '@/design';
import { i18n } from '@/i18n';
import { supabase } from '@/services/api/supabase';

interface FormValues {
  current: string;
  next: string;
  confirm: string;
}

export const passwordSchema = z
  .object({
    current: z.string().min(1, 'currentPasswordWrong'),
    next: z.string().min(8, 'newPasswordTooShort'),
    confirm: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.next === v.current) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['next'],
        message: 'newPasswordEqualsCurrent',
      });
    }
    if (v.next !== v.confirm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirm'],
        message: 'confirmMismatch',
      });
    }
  });

function localizedMessage(code: string): string {
  const t = i18n.t.bind(i18n);
  switch (code) {
    case 'currentPasswordWrong':
      return t('settings.account.errors.currentPasswordWrong');
    case 'newPasswordTooShort':
      return t('settings.account.errors.newPasswordTooShort');
    case 'newPasswordEqualsCurrent':
      return t('settings.account.errors.newPasswordEqualsCurrent');
    case 'confirmMismatch':
      return t('settings.account.errors.confirmMismatch');
    default:
      return t('settings.account.errors.generic');
  }
}

function makeResolver(): Resolver<FormValues> {
  return async (values): Promise<ResolverResult<FormValues>> => {
    const result = passwordSchema.safeParse(values);
    if (result.success) return { values: result.data, errors: {} };
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.length > 0 ? issue.path.join('.') : '_';
      errors[path] = { type: 'zod', message: localizedMessage(issue.message) };
    }
    return { values: {} as Record<string, never>, errors: errors as FieldErrors<FormValues> };
  };
}

const DEFAULTS: FormValues = { current: '', next: '', confirm: '' };

export interface PasswordChangeModalProps {
  visible: boolean;
  email: string;
  onDismiss: () => void;
  onSuccess: () => void;
}

export function PasswordChangeModal({
  visible,
  email,
  onDismiss,
  onSuccess,
}: PasswordChangeModalProps) {
  const { t } = useTranslation();
  const { colors } = useTokens();

  const { control, handleSubmit, formState, reset, setError } = useForm<FormValues>({
    defaultValues: DEFAULTS,
    resolver: makeResolver(),
  });

  const [submitting, setSubmitting] = useState(false);
  const [genericError, setGenericError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      reset(DEFAULTS);
      setGenericError(null);
    }
  }, [visible, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    setGenericError(null);
    // Step 1: re-verify the current password. We deliberately discard
    // the returned session — the user's existing session stays active.
    const verify = await supabase.auth.signInWithPassword({
      email,
      password: values.current,
    });
    if (verify.error || !verify.data.session) {
      setError('current', {
        type: 'auth',
        message: t('settings.account.errors.currentPasswordWrong'),
      });
      setSubmitting(false);
      return;
    }
    // Step 2: rotate the password.
    const update = await supabase.auth.updateUser({ password: values.next });
    if (update.error) {
      setGenericError(t('settings.account.errors.generic'));
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    onSuccess();
  });

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      accessibilityLabel={t('settings.account.changePassword')}
    >
      <Stack gap="md">
        <Text variant="headingMd">{t('settings.account.changePassword')}</Text>
        <Controller
          control={control}
          name="current"
          render={({ field }) => (
            <Input
              label={t('settings.account.currentPassword')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              secureTextEntry
              autoComplete="current-password"
              error={formState.errors.current?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="next"
          render={({ field }) => (
            <Input
              label={t('settings.account.newPassword')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              secureTextEntry
              autoComplete="new-password"
              error={formState.errors.next?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="confirm"
          render={({ field }) => (
            <Input
              label={t('settings.account.confirmPassword')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              secureTextEntry
              autoComplete="new-password"
              error={formState.errors.confirm?.message}
            />
          )}
        />
        {genericError ? (
          <Text variant="body" color={colors.error}>
            {genericError}
          </Text>
        ) : null}
        <Stack gap="sm">
          <Button
            variant="destructive"
            onPress={() => {
              void onSubmit();
            }}
            loading={submitting}
            disabled={submitting}
          >
            {t('settings.account.save')}
          </Button>
          <Button variant="ghost" onPress={onDismiss} disabled={submitting}>
            {t('common.actions.cancel')}
          </Button>
        </Stack>
      </Stack>
    </Modal>
  );
}
