import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { colors } from '../../../src/theme/colors';
import { fontFamily, fontSize, lineHeight } from '../../../src/theme/typography';
import { spacing } from '../../../src/theme/spacing';
import { Input } from '../../../src/components/Input';
import { Button } from '../../../src/components/Button';
import { PhoneInput } from '../../../src/components/PhoneInput';
import { SelectPicker, SelectOption } from '../../../src/components/SelectPicker';
import {
  fullRegistrationSchema,
  FullRegistrationInput,
} from '../../../src/utils/validation';
import { useCreatePerson, useUpdatePerson, usePerson } from '../../../src/hooks/usePersons';
import { useServants } from '../../../src/hooks/useServants';
import { useAuthStore } from '../../../src/stores/authStore';

const LANGUAGE_OPTIONS: SelectOption[] = [
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
];

const PRIORITY_OPTIONS: SelectOption[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'very_low', label: 'Very Low' },
];

export default function RegisterScreen() {
  const { t } = useTranslation();
  const { profile } = useAuthStore();
  const { personId } = useLocalSearchParams<{ personId?: string }>();

  const isUpgrade = !!personId;
  const { data: existingPerson } = usePerson(personId ?? '');
  const { data: servants } = useServants();
  const createPerson = useCreatePerson();
  const updatePerson = useUpdatePerson();

  const servantOptions: SelectOption[] =
    servants?.map((s) => ({
      value: s.id,
      label: `${s.first_name} ${s.last_name}`,
    })) ?? [];

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FullRegistrationInput>({
    resolver: zodResolver(fullRegistrationSchema),
    defaultValues: {
      first_name: existingPerson?.first_name ?? '',
      last_name: existingPerson?.last_name ?? '',
      phone: existingPerson?.phone ?? '+49',
      region: existingPerson?.region ?? '',
      language: existingPerson?.language ?? 'de',
      priority: existingPerson?.priority ?? null,
      assigned_servant_id:
        existingPerson?.assigned_servant_id ?? profile?.id ?? '',
      comments: existingPerson?.comments ?? '',
    },
  });

  async function onSubmit(values: FullRegistrationInput) {
    if (!profile?.id) return;

    try {
      if (isUpgrade && personId) {
        await updatePerson.mutateAsync({
          id: personId,
          input: {
            first_name: values.first_name,
            last_name: values.last_name,
            phone: values.phone,
            region: values.region ?? null,
            language: values.language,
            priority: values.priority,
            assigned_servant_id: values.assigned_servant_id,
            comments: values.comments ?? null,
            registration_type: 'full',
          },
        });
        router.replace(`/(tabs)/people/${personId}`);
      } else {
        const person = await createPerson.mutateAsync({
          first_name: values.first_name,
          last_name: values.last_name,
          phone: values.phone,
          region: values.region ?? null,
          language: values.language,
          priority: values.priority,
          assigned_servant_id: values.assigned_servant_id,
          comments: values.comments ?? null,
          registration_type: 'full',
          registered_by: profile.id,
          paused_until: null,
        });
        router.replace(`/(tabs)/people/${person.id}`);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message.includes('unique')
          ? t('people.phoneDuplicate')
          : t('common.error');
      Alert.alert(t('common.error'), message);
    }
  }

  const isPending =
    isSubmitting || createPerson.isPending || updatePerson.isPending;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {isUpgrade && (
            <View style={styles.upgradeBanner}>
              <Text style={styles.upgradeBannerText}>
                {t('people.upgradeNotice')}
              </Text>
            </View>
          )}

          <Controller
            control={control}
            name="first_name"
            render={({ field: { value, onChange, onBlur } }) => (
              <Input
                label={t('people.firstName')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.first_name?.message}
                autoCapitalize="words"
                returnKeyType="next"
              />
            )}
          />

          <Controller
            control={control}
            name="last_name"
            render={({ field: { value, onChange, onBlur } }) => (
              <Input
                label={t('people.lastName')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.last_name?.message}
                autoCapitalize="words"
                returnKeyType="next"
              />
            )}
          />

          <Controller
            control={control}
            name="phone"
            render={({ field: { value, onChange } }) => (
              <PhoneInput
                label={t('people.phone')}
                value={value}
                onChangeText={onChange}
                error={errors.phone?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="region"
            render={({ field: { value, onChange, onBlur } }) => (
              <Input
                label={t('people.region')}
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.region?.message}
                placeholder="z.B. Sendling"
                autoCapitalize="words"
                returnKeyType="next"
              />
            )}
          />

          <Controller
            control={control}
            name="language"
            render={({ field: { value, onChange } }) => (
              <SelectPicker
                label={t('people.language')}
                value={value}
                options={LANGUAGE_OPTIONS}
                onValueChange={onChange}
                error={errors.language?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="priority"
            render={({ field: { value, onChange } }) => (
              <SelectPicker
                label={t('people.priority')}
                value={value ?? ''}
                options={PRIORITY_OPTIONS}
                onValueChange={onChange}
                placeholder={t('people.priorityPlaceholder')}
                nullable
                nullLabel={t('people.priorityNone')}
                error={errors.priority?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="assigned_servant_id"
            render={({ field: { value, onChange } }) => (
              <SelectPicker
                label={t('people.assignedServant')}
                value={value}
                options={servantOptions}
                onValueChange={onChange}
                error={errors.assigned_servant_id?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="comments"
            render={({ field: { value, onChange, onBlur } }) => (
              <Input
                label={t('people.comments')}
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.comments?.message}
                multiline
                numberOfLines={4}
                style={styles.commentsInput}
                textAlignVertical="top"
              />
            )}
          />

          <Text style={styles.commentsNote}>{t('people.commentsPrivate')}</Text>

          <Button
            title={isUpgrade ? t('common.save') : t('people.register')}
            onPress={handleSubmit(onSubmit)}
            loading={isPending}
            style={styles.submitButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: spacing[5],
    paddingBottom: spacing[10],
  },
  upgradeBanner: {
    backgroundColor: colors.infoBg,
    borderWidth: 1,
    borderColor: colors.info,
    borderRadius: 8,
    padding: spacing[3],
    marginBottom: spacing[4],
  },
  upgradeBannerText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.bodySmall,
    lineHeight: lineHeight.bodySmall,
    color: colors.info,
  },
  commentsInput: {
    height: 100,
    paddingTop: spacing[3],
  },
  commentsNote: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.bodySmall,
    lineHeight: lineHeight.bodySmall,
    color: colors.inkTertiary,
    marginTop: -spacing[3],
    marginBottom: spacing[4],
  },
  submitButton: {
    marginTop: spacing[2],
  },
});
