/**
 * Full Registration form — shared by:
 *   - new-Full registration (`mode='create'`)
 *   - upgrading a Quick Add row (`mode='upgrade'`)
 *   - editing an existing person (`mode='edit'`)
 *
 * Field-level permissions are reflected in the UI:
 *   - Priority radio: disabled for non-admins
 *   - Assigned-Servant picker: disabled for non-admins
 *   - Comments TextInput: hidden when caller is neither admin nor the
 *     currently assigned servant
 *
 * The same constraints are enforced server-side by `update_person`
 * (migration 006). The UI mirror is purely for affordance.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Controller,
  useForm,
  type FieldErrors,
  type Resolver,
  type ResolverResult,
} from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import { Button as PaperButton, Dialog, Portal, RadioButton } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Button, Input, Select, Snackbar, Stack, Text, useTokens } from '@/design';
import { useAuth } from '@/hooks/useAuth';
import { i18n, type SupportedLanguage } from '@/i18n';
import { listServants } from '@/services/api/servants';
import type { Person } from '@/types/person';

import {
  fullRegistrationSchema,
  FULL_REG_PRIORITIES,
  type FullRegistrationOutput,
  type FullRegLanguage,
  type FullRegPriority,
} from './schemas/fullRegistrationSchema';
import {
  ForbiddenFieldError,
  ReassignmentReasonRequiredError,
  localizedSubmitError,
  useFullRegistrationSubmit,
  type DuplicateHit,
  type FullRegistrationMode,
  type SubmitResult,
} from './hooks/useFullRegistrationSubmit';

type FormValues = {
  first_name: string;
  last_name: string;
  phone: string;
  region: string;
  language: SupportedLanguage;
  priority: FullRegPriority;
  assigned_servant: string;
  comments: string;
  reassignment_reason: string;
};

export interface FullRegistrationFormProps {
  mode: FullRegistrationMode;
  /** Current person (required for `upgrade` and `edit`). */
  person?: Person;
  onSubmitSuccess: (result: SubmitResult) => void;
  /** Override the submit-button label (defaults to localized Save). */
  submitLabel?: string;
}

function appLanguage(): SupportedLanguage {
  const lng = (i18n.language ?? 'en') as string;
  if (lng === 'ar' || lng === 'de') return lng;
  return 'en';
}

function zodResolver(): Resolver<FormValues> {
  return async (values): Promise<ResolverResult<FormValues>> => {
    const result = fullRegistrationSchema.safeParse({
      first_name: values.first_name,
      last_name: values.last_name,
      phone: values.phone,
      region: values.region,
      language: values.language,
      priority: values.priority,
      assigned_servant: values.assigned_servant,
      comments: values.comments,
      reassignment_reason: values.reassignment_reason,
    });
    if (result.success) {
      return {
        values: {
          first_name: result.data.first_name,
          last_name: result.data.last_name,
          phone: result.data.phone,
          region: result.data.region ?? '',
          language: result.data.language,
          priority: result.data.priority,
          assigned_servant: result.data.assigned_servant,
          comments: result.data.comments ?? '',
          reassignment_reason: result.data.reassignment_reason ?? '',
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
    case 'comments':
      return t('registration.full.errors.commentsTooLong');
    case 'assigned_servant':
      return t('registration.full.errors.assignedServantRequired');
    default:
      return t('common.errors.generic');
  }
}

export function FullRegistrationForm({
  mode,
  person,
  onSubmitSuccess,
  submitLabel,
}: FullRegistrationFormProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTokens();
  const { servant } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = servant?.role === 'admin';
  const callerId = servant?.id ?? '';

  const canEditComments = useMemo(() => {
    if (!servant) return false;
    if (servant.role === 'admin') return true;
    if (mode === 'create') return true; // creator is the assigned servant
    return person?.assigned_servant === servant.id;
  }, [mode, person?.assigned_servant, servant]);

  const servantsQuery = useQuery({
    queryKey: ['servants', 'active'],
    queryFn: listServants,
    enabled: isAdmin,
    staleTime: 60_000,
  });

  // Make sure the current assigned servant is always selectable in the
  // picker. Non-admin callers can't fetch the full servants list, and
  // even admins' results may exclude a deactivated servant. We always
  // synthesize an option for the current assigned_servant so the field
  // shows a meaningful label rather than the placeholder.
  const servantOptions = useMemo(() => {
    const list = servantsQuery.data ?? [];
    const options = list.map((s) => ({
      value: s.id,
      label: s.display_name?.trim() || s.email,
    }));
    const ensureOption = (id: string | undefined, label: string) => {
      if (!id) return;
      if (options.some((o) => o.value === id)) return;
      options.push({ value: id, label });
    };
    if (mode !== 'create' && person) {
      ensureOption(person.assigned_servant, t('registration.full.assignedServantCurrent'));
    }
    ensureOption(
      callerId || undefined,
      servant?.display_name?.trim() || servant?.email || callerId,
    );
    return options;
  }, [servantsQuery.data, mode, person, t, callerId, servant]);

  const defaultValues: FormValues = useMemo(() => {
    if (mode === 'create' || !person) {
      return {
        first_name: '',
        last_name: '',
        phone: '+49 ',
        region: '',
        language: appLanguage(),
        priority: 'medium',
        assigned_servant: callerId,
        comments: '',
        reassignment_reason: '',
      };
    }
    return {
      first_name: person.first_name,
      last_name: person.last_name,
      phone: person.phone ?? '',
      region: person.region ?? '',
      language: person.language,
      priority: person.priority,
      assigned_servant: person.assigned_servant,
      comments: person.comments ?? '',
      reassignment_reason: '',
    };
  }, [mode, person, callerId]);

  const { control, handleSubmit, formState, watch, reset } = useForm<FormValues>({
    defaultValues,
    resolver: zodResolver(),
  });

  // Re-seed when the person prop becomes available (e.g. async load).
  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const watchedAssignedServant = watch('assigned_servant');
  const showReassignReason =
    mode !== 'create' && person && watchedAssignedServant !== person.assigned_servant;

  const [errorSnack, setErrorSnack] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateHit | null>(null);
  const [resolveDuplicate, setResolveDuplicate] = useState<
    ((choice: 'use-existing' | 'save-anyway') => void) | null
  >(null);

  const { submit, isSubmitting } = useFullRegistrationSubmit({
    context: {
      mode,
      personId: person?.id,
      initialPerson: person,
      canEditComments,
      isAdmin,
    },
    onDuplicate: async (hit) => {
      setDuplicate(hit);
      return new Promise<'use-existing' | 'save-anyway'>((resolve) => {
        setResolveDuplicate(() => resolve);
      });
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    const parsed: FullRegistrationOutput = {
      first_name: values.first_name,
      last_name: values.last_name,
      phone: values.phone,
      region: values.region.trim() === '' ? undefined : values.region,
      language: values.language,
      priority: values.priority,
      assigned_servant: values.assigned_servant,
      comments: values.comments.trim() === '' ? undefined : values.comments,
      reassignment_reason:
        values.reassignment_reason.trim() === '' ? undefined : values.reassignment_reason,
    };
    try {
      const result = await submit(parsed);
      if (!result) return;
      await queryClient.invalidateQueries({ queryKey: ['persons'] });
      await queryClient.invalidateQueries({ queryKey: ['person'] });
      onSubmitSuccess(result);
    } catch (err) {
      if (err instanceof ReassignmentReasonRequiredError) {
        setErrorSnack(t('persons.edit.errorReasonRequired'));
        return;
      }
      if (err instanceof ForbiddenFieldError) {
        setErrorSnack(localizedSubmitError(err));
        return;
      }
      setErrorSnack(t('common.errors.generic'));
    }
  });

  const onUseExisting = () => {
    setDuplicate(null);
    if (resolveDuplicate) resolveDuplicate('use-existing');
    setResolveDuplicate(null);
  };
  const onSaveAnyway = () => {
    setDuplicate(null);
    if (resolveDuplicate) resolveDuplicate('save-anyway');
    setResolveDuplicate(null);
  };

  const showCommentsField = canEditComments;
  const priorityDisabled = !isAdmin;
  const servantDisabled = !isAdmin;

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
                  onValueChange={(v) => field.onChange(v as FullRegLanguage)}
                >
                  <RadioButton.Item value="en" label={t('registration.quickAdd.languageEN')} />
                  <RadioButton.Item value="ar" label={t('registration.quickAdd.languageAR')} />
                  <RadioButton.Item value="de" label={t('registration.quickAdd.languageDE')} />
                </RadioButton.Group>
              )}
            />
          </Stack>

          <Stack gap="xs">
            <Text variant="label" color={colors.textMuted}>
              {t('registration.full.priority')}
              {priorityDisabled ? ` ${t('registration.full.adminOnlyHint')}` : ''}
            </Text>
            <Controller
              control={control}
              name="priority"
              render={({ field }) => (
                <View accessibilityState={{ disabled: priorityDisabled }}>
                  <RadioButton.Group
                    value={field.value}
                    onValueChange={(v) => field.onChange(v as FullRegPriority)}
                  >
                    {FULL_REG_PRIORITIES.map((p) => (
                      <RadioButton.Item
                        key={p}
                        value={p}
                        label={t(`registration.full.priorityOption.${p}` as const)}
                        disabled={priorityDisabled}
                      />
                    ))}
                  </RadioButton.Group>
                </View>
              )}
            />
          </Stack>

          <Stack gap="xs">
            <Text variant="label" color={colors.textMuted}>
              {t('registration.full.assignedServant')}
              {servantDisabled ? ` ${t('registration.full.adminOnlyHint')}` : ''}
            </Text>
            <Controller
              control={control}
              name="assigned_servant"
              render={({ field }) => (
                <Select
                  value={field.value}
                  options={servantOptions}
                  onChange={field.onChange}
                  disabled={servantDisabled}
                  accessibilityLabel={t('registration.full.assignedServant')}
                />
              )}
            />
          </Stack>

          {showReassignReason ? (
            <Controller
              control={control}
              name="reassignment_reason"
              render={({ field }) => (
                <Input
                  label={t('registration.full.reassignReason')}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  multiline
                  error={formState.errors.reassignment_reason?.message}
                />
              )}
            />
          ) : null}

          {showCommentsField ? (
            <Controller
              control={control}
              name="comments"
              render={({ field }) => (
                <Input
                  label={t('registration.full.comments')}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  multiline
                  numberOfLines={4}
                  maxLength={1000}
                  error={formState.errors.comments?.message}
                />
              )}
            />
          ) : null}
        </Stack>

        <Button
          onPress={() => {
            void onSubmit();
          }}
          loading={formState.isSubmitting || isSubmitting}
          disabled={formState.isSubmitting || isSubmitting}
        >
          {submitLabel ?? t('registration.full.save')}
        </Button>
      </ScrollView>

      <Portal>
        <Dialog visible={duplicate !== null} onDismiss={onUseExisting}>
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
            <PaperButton onPress={onSaveAnyway}>
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
