/**
 * Returns the active i18n language. Loosely coupled to i18next so the
 * design system stays usable in tests and in phases where i18n init
 * has not yet landed. Defaults to "en" if i18next is unavailable.
 */
import { useEffect, useState } from 'react';

interface I18nLike {
  language?: string;
  on?: (event: string, handler: (lang: string) => void) => void;
  off?: (event: string, handler: (lang: string) => void) => void;
}

function loadI18n(): I18nLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('i18next');
    return (mod?.default ?? mod) as I18nLike;
  } catch {
    return null;
  }
}

export function getLanguageSync(): string {
  const i18n = loadI18n();
  return i18n?.language ?? 'en';
}

export function useLanguage(): string {
  const [lang, setLang] = useState(getLanguageSync());
  useEffect(() => {
    const i18n = loadI18n();
    if (!i18n?.on || !i18n?.off) return;
    const handler = (next: string) => setLang(next);
    i18n.on('languageChanged', handler);
    return () => i18n.off?.('languageChanged', handler);
  }, []);
  return lang;
}

export function isRTLLanguage(lang: string): boolean {
  return lang === 'ar' || lang === 'he' || lang === 'fa' || lang === 'ur';
}
