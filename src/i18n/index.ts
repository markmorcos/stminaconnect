/**
 * Minimal i18n bootstrap that exposes `t()` for the About screen and
 * the design system's language hook. Loads the EN/AR/DE bundles
 * eagerly. The full bootstrap (device-locale detection, AsyncStorage
 * persistence, RTL handling, language switcher) lands in
 * `add-i18n-foundation`.
 */
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import ar from './locales/ar.json';
import de from './locales/de.json';
import en from './locales/en.json';

export const resources = {
  en: { translation: en },
  ar: { translation: ar },
  de: { translation: de },
} as const;

if (!i18next.isInitialized) {
  // eslint-disable-next-line import/no-named-as-default-member -- i18next.use() is the documented chain API
  i18next
    .use(initReactI18next)
    .init({
      resources,
      lng: 'en',
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
      compatibilityJSON: 'v4',
    })
    .catch(() => {
      // Init is synchronous for in-memory bundles; the `.catch` is
      // defensive. Callers fall back to the EN string via `fallbackLng`.
    });
}

export { i18next };
