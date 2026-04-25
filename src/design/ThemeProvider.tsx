import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';

import { buildPaperTheme, type ThemeMode } from './theme';
import { tokensFor, type Tokens } from './tokens';

export type ThemeModeSetting = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'app.themeMode';

interface ThemeContextValue {
  mode: ThemeModeSetting;
  resolved: ThemeMode;
  isDark: boolean;
  tokens: Tokens;
  setMode: (mode: ThemeModeSetting) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
  /**
   * Optional initial mode. If omitted, the provider reads
   * `AsyncStorage[app.themeMode]` and falls back to `'system'`.
   */
  initialMode?: ThemeModeSetting;
}

function isThemeModeSetting(value: unknown): value is ThemeModeSetting {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function ThemeProvider({ children, initialMode }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeModeSetting>(initialMode ?? 'system');
  const [hydrated, setHydrated] = useState<boolean>(initialMode !== undefined);

  useEffect(() => {
    if (initialMode !== undefined) return;
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        if (isThemeModeSetting(stored)) setModeState(stored);
        setHydrated(true);
      })
      .catch(() => {
        if (cancelled) return;
        setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [initialMode]);

  const resolved: ThemeMode = useMemo(() => {
    if (mode === 'system') return systemScheme === 'dark' ? 'dark' : 'light';
    return mode;
  }, [mode, systemScheme]);

  const paperTheme = useMemo(() => buildPaperTheme(resolved), [resolved]);
  const tokens = useMemo(() => tokensFor(resolved), [resolved]);

  const setMode = useCallback(async (next: ThemeModeSetting) => {
    setModeState(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, next);
    } catch {
      // best-effort persistence; in-memory state still updates
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolved,
      isDark: resolved === 'dark',
      tokens,
      setMode,
    }),
    [mode, resolved, tokens, setMode],
  );

  if (!hydrated) return null;

  return (
    <ThemeContext.Provider value={value}>
      <PaperProvider theme={paperTheme}>{children}</PaperProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme() must be used inside <ThemeProvider>');
  }
  return ctx;
}

export function useTokens(): Tokens {
  return useTheme().tokens;
}

export function useThemeMode(): {
  mode: ThemeModeSetting;
  resolved: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeModeSetting) => Promise<void>;
} {
  const { mode, resolved, isDark, setMode } = useTheme();
  return { mode, resolved, isDark, setMode };
}

export const __THEME_STORAGE_KEY = STORAGE_KEY;
