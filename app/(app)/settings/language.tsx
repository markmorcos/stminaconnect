/**
 * Language switcher — three options. Same-direction switches apply
 * instantly via `i18n.changeLanguage`; switches that flip RTL prompt
 * a confirmation Modal, then call `Updates.reloadAsync` so React
 * Native picks up the new layout direction.
 */
import { useState } from 'react';
import { I18nManager, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Chip, Modal, Stack, Text, useTokens } from '@/design';
import { isRtl, setLanguageNoReload, setLanguageWithReload, type SupportedLanguage } from '@/i18n';

interface Option {
  code: SupportedLanguage;
  labelKey: 'settings.language.english' | 'settings.language.arabic' | 'settings.language.german';
}

const OPTIONS: readonly Option[] = [
  { code: 'en', labelKey: 'settings.language.english' },
  { code: 'ar', labelKey: 'settings.language.arabic' },
  { code: 'de', labelKey: 'settings.language.german' },
];

export default function LanguageScreen() {
  const { t, i18n } = useTranslation();
  const { spacing, colors } = useTokens();
  const [pending, setPending] = useState<SupportedLanguage | null>(null);

  const current = ((i18n.language as SupportedLanguage | undefined) ?? 'en') as SupportedLanguage;

  async function handleSelect(next: SupportedLanguage) {
    if (next === current) return;
    if (isRtl(next) !== I18nManager.isRTL) {
      setPending(next);
      return;
    }
    await setLanguageNoReload(next);
  }

  async function handleConfirm() {
    if (!pending) return;
    await setLanguageWithReload(pending);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
        <Stack gap="sm">
          {OPTIONS.map((opt) => (
            <Chip
              key={opt.code}
              selected={opt.code === current}
              onPress={() => {
                void handleSelect(opt.code);
              }}
              accessibilityLabel={t(opt.labelKey)}
            >
              {t(opt.labelKey)}
            </Chip>
          ))}
        </Stack>
      </ScrollView>
      <Modal
        visible={pending !== null}
        onDismiss={() => setPending(null)}
        accessibilityLabel={t('settings.language.restartNeeded.title')}
      >
        <Stack gap="md">
          <Text variant="headingMd">{t('settings.language.restartNeeded.title')}</Text>
          <Text variant="body" color={colors.textMuted}>
            {t('settings.language.restartNeeded.body')}
          </Text>
          <Stack gap="sm">
            <Button
              onPress={() => {
                void handleConfirm();
              }}
            >
              {t('settings.language.restartNeeded.confirm')}
            </Button>
            <Button variant="ghost" onPress={() => setPending(null)}>
              {t('settings.language.restartNeeded.cancel')}
            </Button>
          </Stack>
        </Stack>
      </Modal>
    </View>
  );
}
