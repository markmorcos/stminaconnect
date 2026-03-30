import { create } from "zustand";
import { SupportedLanguage } from "../i18n";

interface SettingsState {
  language: SupportedLanguage;
  colorScheme: "light" | "dark" | "system";
  setLanguage: (language: SupportedLanguage) => void;
  setColorScheme: (colorScheme: "light" | "dark" | "system") => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  language: "en",
  colorScheme: "system",
  setLanguage: (language) => set({ language }),
  setColorScheme: (colorScheme) => set({ colorScheme }),
}));
