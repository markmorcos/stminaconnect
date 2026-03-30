import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";

import en from "./en.json";
import ar from "./ar.json";
import de from "./de.json";

const LANGUAGE_KEY = "stmina_language";

const resources = {
  en: { translation: en },
  ar: { translation: ar },
  de: { translation: de },
};

export const supportedLanguages = ["en", "ar", "de"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export const languageNames: Record<SupportedLanguage, string> = {
  en: "English",
  ar: "العربية",
  de: "Deutsch",
};

function getDeviceLanguage(): SupportedLanguage {
  const locales = getLocales();
  const deviceLang = locales[0]?.languageCode;
  if (deviceLang && supportedLanguages.includes(deviceLang as SupportedLanguage)) {
    return deviceLang as SupportedLanguage;
  }
  return "en";
}

export async function getSavedLanguage(): Promise<SupportedLanguage | null> {
  const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
  if (saved && supportedLanguages.includes(saved as SupportedLanguage)) {
    return saved as SupportedLanguage;
  }
  return null;
}

export async function saveLanguage(lang: SupportedLanguage): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, lang);
}

i18n.use(initReactI18next).init({
  resources,
  lng: getDeviceLanguage(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;
