import { useState } from 'react';
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
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { colors } from '../../../src/theme/colors';
import { fontFamily, fontSize, lineHeight } from '../../../src/theme/typography';
import { spacing } from '../../../src/theme/spacing';
import { radius } from '../../../src/theme/radius';
import { Input } from '../../../src/components/Input';
import { Button } from '../../../src/components/Button';
import { PhoneInput } from '../../../src/components/PhoneInput';
import { SelectPicker, SelectOption } from '../../../src/components/SelectPicker';
import { quickAddSchema, QuickAddInput } from '../../../src/utils/validation';
import { useCreatePerson } from '../../../src/hooks/usePersons';
import { useAuthStore } from '../../../src/stores/authStore';

const LANGUAGE_OPTIONS: SelectOption[] = [
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
];

const GREETING: Record<string, string> = {
  en: 'Welcome! Please enter your details.',
  ar: '!مرحبًا! يرجى ملء بياناتك',
  de: 'Willkommen! Bitte geben Sie Ihre Daten ein.',
};

export default function QuickAddScreen() {
  const { t } = useTranslation();
  const { profile } = useAuthStore();
  const createPerson = useCreatePerson();

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<QuickAddInput>({
    resolver: zodResolver(quickAddSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      phone: '+49',
      region: '',
      language: 'de',
    },
  });

  const selectedLanguage = watch('language');
  const greeting = GREETING[selectedLanguage] ?? GREETING.en;

  async function onSubmit(values: QuickAddInput) {
    if (!profile?.id) return;

    try {
      await createPerson.mutateAsync({
        first_name: values.first_name,
        last_name: values.last_name,
        phone: values.phone,
        region: values.region ?? null,
        language: values.language,
        registration_type: 'quick_add',
        registered_by: profile.id,
        assigned_servant_id: profile.id,
        priority: null,
        comments: null,
        paused_until: null,
      });
      router.back();
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message.includes('unique')
          ? t('people.phoneDuplicate')
          : t('common.error');
      Alert.alert(t('common.error'), message);
    }
  }

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
          {/* Greeting */}
          <View style={styles.greetingCard}>
            <Text style={styles.greetingText}>{greeting}</Text>
          </View>

          {/* Language selector (changes greeting in real-time) */}
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
                returnKeyType="done"
              />
            )}
          />

          <Button
            title={t('common.done')}
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting || createPerson.isPending}
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
  greetingCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing[5],
    marginBottom: spacing[6],
  },
  greetingText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.bodyLarge,
    lineHeight: lineHeight.bodyLarge,
    color: colors.white,
    textAlign: 'center',
  },
  submitButton: {
    marginTop: spacing[4],
  },
});
