import { ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LegalDocBody } from '@/components/LegalDocBody';
import { useTokens } from '@/design';
import { getLegalDoc } from '@/services/legal/getLegalDoc';
import type { LegalLang } from '@/services/legal/offlineLegalDocs';

function isLegalLang(lang: string): lang is LegalLang {
  return lang === 'en' || lang === 'ar' || lang === 'de';
}

export default function TermsDocScreen() {
  const { spacing, colors } = useTokens();
  const { i18n } = useTranslation();
  const docLang: LegalLang = isLegalLang(i18n.language) ? (i18n.language as LegalLang) : 'en';
  const doc = getLegalDoc('terms', docLang);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg }}
    >
      <LegalDocBody body={doc.body} />
    </ScrollView>
  );
}
