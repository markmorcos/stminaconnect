/**
 * Quick Add — five-field form a servant hands to a newcomer on first
 * contact. Persists to `persons` via `create_person` (which auto-stamps
 * `assigned_servant = auth.uid()` for non-admin callers).
 *
 * Form labels stay in the *app* language: the servant is operating the
 * device, so they need to read the labels. The Language radio captures
 * the newcomer's preferred language and persists it on the row — it
 * does not retranslate the form.
 *
 * Submit pipeline:
 *   1. RHF + Zod validate the five fields.
 *   2. `find_potential_duplicate` checks for an existing match. A non-
 *      null hit opens a Paper Dialog; the servant chooses "Use
 *      existing" (navigate) or "Save anyway" (proceed).
 *   3. `create_person` writes the row.
 *   4. We `router.replace('/?welcome=<first>')`. The home screen reads
 *      that param and surfaces the success snackbar in the active app
 *      language.
 */
import { useState } from 'react';
import {
  Controller,
  useForm,
  type FieldErrors,
  type Resolver,
  type ResolverResult,
} from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button as PaperButton, Dialog, Portal, RadioButton } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';

import { Button, Input, Snackbar, Stack, Text, useTokens } from '@/design';
import {
  quickAddSchema,
  type QuickAddOutput,
} from '@/features/registration/schemas/quickAddSchema';
import { i18n, type SupportedLanguage } from '@/i18n';
import { createPerson, findPotentialDuplicate, getPerson } from '@/services/api/persons';

function appLanguage(): SupportedLanguage {
  const lng = (i18n.language ?? 'en') as string;
  if (lng === 'ar' || lng === 'de') return lng;
  return 'en';
}

type FormValues = {
  first_name: string;
  last_name: string;
  phone: string;
  region: string;
  language: SupportedLanguage;
};

function zodResolver(): Resolver<FormValues> {
  return async (values): Promise<ResolverResult<FormValues>> => {
    const result = quickAddSchema.safeParse(values);
    if (result.success) {
      return {
        values: {
          first_name: result.data.first_name,
          last_name: result.data.last_name,
          phone: result.data.phone,
          region: result.data.region ?? '',
          language: result.data.language,
        },
        errors: {},
      };
    }
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.length > 0 ? issue.path.join('.') : '_';
      errors[path] = { type: 'zod', message: messageForPath(path) };
    }
    return {
      values: {} as Record<string, never>,
      errors: errors as FieldErrors<FormValues>,
    };
  };
}

function messageForPath(path: string): string {
  const t = i18n.t.bind(i18n);
  switch (path) {
    case 'first_name':
      return t('registration.quickAdd.errors.firstNameRequired');
    case 'last_name':
      return t('registration.quickAdd.errors.lastNameRequired');
    case 'phone':
      return t('registration.quickAdd.errors.phoneInvalid');
    case 'region':
      return t('registration.quickAdd.errors.regionTooLong');
    default:
      return t('common.errors.generic');
  }
}

export default function QuickAddScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [errorSnack, setErrorSnack] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ id: string; name: string } | null>(null);
  const [pendingPayload, setPendingPayload] = useState<QuickAddOutput | null>(null);

  const { control, handleSubmit, formState } = useForm<FormValues>({
    defaultValues: {
      first_name: '',
      last_name: '',
      phone: '+49 ',
      region: '',
      language: appLanguage(),
    },
    resolver: zodResolver(),
  });

  const submit = handleSubmit(async (values) => {
    const parsed: QuickAddOutput = {
      first_name: values.first_name,
      last_name: values.last_name,
      phone: values.phone,
      region: values.region.trim() === '' ? undefined : values.region,
      language: values.language,
    };
    const dupId = await findPotentialDuplicate(
      parsed.first_name,
      parsed.last_name,
      parsed.phone,
    ).catch(() => null);
    if (dupId) {
      let name = `${parsed.first_name} ${parsed.last_name}`.trim();
      try {
        const existing = await getPerson(dupId);
        if (existing) name = `${existing.first_name} ${existing.last_name}`.trim();
      } catch {
        /* fall back to typed name */
      }
      setPendingPayload(parsed);
      setDuplicate({ id: dupId, name });
      return;
    }
    await createAndExit(parsed);
  });

  const createAndExit = async (parsed: QuickAddOutput) => {
    try {
      await createPerson({
        first_name: parsed.first_name,
        last_name: parsed.last_name,
        phone: parsed.phone,
        region: parsed.region ?? null,
        language: parsed.language,
        // Omit assigned_servant: the RPC defaults to auth.uid() for
        // both admin and non-admin callers when the field is absent.
        registration_type: 'quick_add',
      });
      await queryClient.invalidateQueries({ queryKey: ['persons'] });
      await queryClient.invalidateQueries({ queryKey: ['person'] });
      await queryClient.invalidateQueries({ queryKey: ['servant-dashboard'] });
      router.replace({ pathname: '/', params: { welcome: parsed.first_name } });
    } catch {
      setErrorSnack(t('registration.quickAdd.errorGeneric'));
    }
  };

  const onConfirmSaveAnyway = async () => {
    const payload = pendingPayload;
    setDuplicate(null);
    setPendingPayload(null);
    if (payload) await createAndExit(payload);
  };

  const onUseExisting = () => {
    const id = duplicate?.id;
    setDuplicate(null);
    setPendingPayload(null);
    if (id) router.replace(`/persons/${id}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        keyboardShouldPersistTaps="handled"
      >
        <Stack gap="sm">
          <Controller
            control={control}
            name="first_name"
            render={({ field }) => (
              <Input
                label={t('registration.quickAdd.firstName')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                autoCapitalize="words"
                autoComplete="name-given"
                error={formState.errors.first_name?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="last_name"
            render={({ field }) => (
              <Input
                label={t('registration.quickAdd.lastName')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                autoCapitalize="words"
                autoComplete="name-family"
                error={formState.errors.last_name?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <Input
                label={t('registration.quickAdd.phone')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                keyboardType="phone-pad"
                autoComplete="tel"
                error={formState.errors.phone?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="region"
            render={({ field }) => (
              <Input
                label={t('registration.quickAdd.region')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                autoCapitalize="words"
                error={formState.errors.region?.message}
              />
            )}
          />

          <Stack gap="xs">
            <Text variant="label" color={colors.textMuted}>
              {t('registration.quickAdd.language')}
            </Text>
            <Controller
              control={control}
              name="language"
              render={({ field }) => (
                <RadioButton.Group
                  value={field.value}
                  onValueChange={(v) => field.onChange(v as SupportedLanguage)}
                >
                  <RadioButton.Item value="en" label={t('registration.quickAdd.languageEN')} />
                  <RadioButton.Item value="ar" label={t('registration.quickAdd.languageAR')} />
                  <RadioButton.Item value="de" label={t('registration.quickAdd.languageDE')} />
                </RadioButton.Group>
              )}
            />
          </Stack>
        </Stack>

        <Button
          onPress={() => {
            void submit();
          }}
          loading={formState.isSubmitting}
          disabled={formState.isSubmitting}
        >
          {t('registration.quickAdd.save')}
        </Button>
      </ScrollView>

      <Portal>
        <Dialog visible={duplicate !== null} onDismiss={() => setDuplicate(null)}>
          <Dialog.Title>{t('registration.quickAdd.duplicateDialogTitle')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="body">
              {t('registration.quickAdd.duplicateDialogBody', { name: duplicate?.name ?? '' })}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <PaperButton onPress={onUseExisting}>
              {t('registration.quickAdd.useExisting')}
            </PaperButton>
            <PaperButton onPress={onConfirmSaveAnyway}>
              {t('registration.quickAdd.saveAnyway')}
            </PaperButton>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={errorSnack !== null} onDismiss={() => setErrorSnack(null)} duration={4000}>
        {errorSnack ?? ''}
      </Snackbar>
    </View>
  );
}
