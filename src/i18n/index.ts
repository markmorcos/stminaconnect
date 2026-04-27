/**
 * i18n bootstrap. Boot order:
 *   1. Module load wires i18next with the EN bundle synchronously so any
 *      module that imports `'@/i18n'` (e.g., tests, the About screen)
 *      can call `t()` immediately.
 *   2. `app/_layout.tsx` calls `bootstrapI18n()` to resolve the real
 *      language from `AsyncStorage['app.lang']` → device locale → `en`,
 *      switch i18next to it, and reconcile `I18nManager.isRTL`. The
 *      first run that needs an RTL flip triggers a one-time
 *      `Updates.reloadAsync()`, gated on the `app.rtlBootstrapped` flag
 *      so reloads can't loop.
 *   3. The language switcher uses `setLanguageNoReload` for same-side
 *      changes and `setLanguageWithReload` when RTL must flip.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import * as Updates from 'expo-updates';
import i18next from 'i18next';
import { DevSettings, I18nManager } from 'react-native';
import { initReactI18next } from 'react-i18next';
import {
  registerTranslation,
  ar as paperDatesAr,
  de as paperDatesDe,
  en as paperDatesEn,
} from 'react-native-paper-dates';

import ar from './locales/ar.json';
import de from './locales/de.json';
import en from './locales/en.json';

// Register react-native-paper-dates locales once at module load so the
// DatePickerModal renders translated weekdays/months across our three
// supported languages.
registerTranslation('en', paperDatesEn);
registerTranslation('ar', paperDatesAr);
registerTranslation('de', paperDatesDe);

export const SUPPORTED_LANGUAGES = ['en', 'ar', 'de'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANG_STORAGE_KEY = 'app.lang';
export const RTL_BOOTSTRAP_KEY = 'app.rtlBootstrapped';

export const resources = {
  en: { translation: en },
  ar: { translation: ar },
  de: { translation: de },
} as const;

const RTL_LANGUAGES: ReadonlySet<SupportedLanguage> = new Set(['ar']);

export function isRtl(lang: SupportedLanguage): boolean {
  return RTL_LANGUAGES.has(lang);
}

function clampLanguage(value: string | null | undefined): SupportedLanguage | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower === 'en' || lower === 'ar' || lower === 'de') return lower as SupportedLanguage;
  return null;
}

function detectDeviceLanguage(): SupportedLanguage {
  try {
    const locales = Localization.getLocales();
    const code = locales?.[0]?.languageCode ?? null;
    return clampLanguage(code) ?? 'en';
  } catch {
    return 'en';
  }
}

async function readStoredLanguage(): Promise<SupportedLanguage | null> {
  try {
    return clampLanguage(await AsyncStorage.getItem(LANG_STORAGE_KEY));
  } catch {
    return null;
  }
}

function initI18next(lng: SupportedLanguage) {
  if (i18next.isInitialized) {
    if (i18next.language !== lng) {
      // eslint-disable-next-line import/no-named-as-default-member -- i18next exposes its API on the default export
      i18next.changeLanguage(lng).catch(() => {});
    }
    return;
  }
  // eslint-disable-next-line import/no-named-as-default-member -- i18next.use() is the documented chain API
  i18next
    .use(initReactI18next)
    .init({
      resources,
      lng,
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
      compatibilityJSON: 'v4',
    })
    .catch(() => {
      // Init is synchronous for in-memory bundles; the `.catch` is
      // defensive. Callers fall back to the EN string via `fallbackLng`.
    });
}

let bootstrapPromise: Promise<SupportedLanguage> | null = null;

export async function bootstrapI18n(): Promise<SupportedLanguage> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    const stored = await readStoredLanguage();
    const lng = stored ?? detectDeviceLanguage();
    initI18next(lng);
    await reconcileRtl(lng);
    return lng;
  })();
  return bootstrapPromise;
}

async function reconcileRtl(lng: SupportedLanguage): Promise<void> {
  const targetIsRtl = isRtl(lng);
  let bootstrapped: string | null = null;
  try {
    bootstrapped = await AsyncStorage.getItem(RTL_BOOTSTRAP_KEY);
  } catch {
    /* ignore */
  }

  if (I18nManager.isRTL === targetIsRtl) {
    if (bootstrapped !== '1') {
      await AsyncStorage.setItem(RTL_BOOTSTRAP_KEY, '1').catch(() => {});
    }
    return;
  }

  // Set the flag before reloading so the reload loop can't recur if
  // forceRTL/reload races.
  await AsyncStorage.setItem(RTL_BOOTSTRAP_KEY, '1').catch(() => {});
  I18nManager.allowRTL(targetIsRtl);
  I18nManager.forceRTL(targetIsRtl);
  await reloadApp();
}

/**
 * Reload the JS bundle. In Expo Go and dev clients we go through
 * `DevSettings.reload()` because `Updates.reloadAsync()` requires a
 * configured updates module that Expo Go doesn't ship — calling it
 * there crashes with a TurboModule signature error. Standalone builds
 * fall through to `Updates.reloadAsync()`.
 */
async function reloadApp(): Promise<void> {
  if (__DEV__ && typeof DevSettings.reload === 'function') {
    DevSettings.reload();
    return;
  }
  try {
    await Updates.reloadAsync();
  } catch {
    /* last-resort fallback so we don't leave the user wedged */
    if (typeof DevSettings.reload === 'function') DevSettings.reload();
  }
}

export async function setLanguageNoReload(next: SupportedLanguage): Promise<void> {
  await AsyncStorage.setItem(LANG_STORAGE_KEY, next).catch(() => {});
  // eslint-disable-next-line import/no-named-as-default-member -- i18next exposes its API on the default export
  await i18next.changeLanguage(next);
}

export async function setLanguageWithReload(next: SupportedLanguage): Promise<void> {
  const targetIsRtl = isRtl(next);
  await AsyncStorage.setItem(LANG_STORAGE_KEY, next).catch(() => {});
  await AsyncStorage.setItem(RTL_BOOTSTRAP_KEY, '1').catch(() => {});
  I18nManager.allowRTL(targetIsRtl);
  I18nManager.forceRTL(targetIsRtl);
  await reloadApp();
}

/**
 * Test-only: clear the cached bootstrap promise so the next call
 * re-runs detection. Keeps tests independent without leaking module
 * state between them.
 */
export function __resetI18nBootstrapForTests() {
  bootstrapPromise = null;
}

// Synchronous fallback init so `t()` works at module load. Bootstrap
// later switches the language via `changeLanguage`.
if (!i18next.isInitialized) {
  initI18next('en');
}

export { i18next };
export const i18n = i18next;
