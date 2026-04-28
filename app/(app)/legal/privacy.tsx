import { ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LegalDocBody } from '@/components/LegalDocBody';
import { useTokens } from '@/design';
import { getLegalDoc } from '@/services/legal/getLegalDoc';
import type { LegalLang } from '@/services/legal/offlineLegalDocs';

function isLegalLang(lang: string): lang is LegalLang {
  return lang === 'en' || lang === 'ar' || lang === 'de';
}

export default function PrivacyDocScreen() {
  const { spacing, colors } = useTokens();
  // useTranslation subscribes to i18next's languageChanged event via
  // react-i18next's internal listener, so the screen re-renders when
  // the user switches language (EN ⇄ DE without reload, or after the
  // RTL reload for AR).
  const { i18n } = useTranslation();
  const docLang: LegalLang = isLegalLang(i18n.language) ? (i18n.language as LegalLang) : 'en';
  const doc = getLegalDoc('privacy', docLang);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg }}
    >
      <LegalDocBody body={doc.body} />
    </ScrollView>
  );
}
