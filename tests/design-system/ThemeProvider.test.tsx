import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render } from '@testing-library/react-native';

import { __THEME_STORAGE_KEY, ThemeProvider, useThemeMode } from '@/design/ThemeProvider';

function Probe({ onReady }: { onReady: (api: ReturnType<typeof useThemeMode>) => void }) {
  const api = useThemeMode();
  onReady(api);
  return null;
}

describe('ThemeProvider', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('defaults to system mode when no override is stored', async () => {
    let captured: ReturnType<typeof useThemeMode> | null = null;
    render(
      <ThemeProvider>
        <Probe onReady={(api) => (captured = api)} />
      </ThemeProvider>,
    );
    // Wait microtasks for AsyncStorage to resolve
    await act(async () => {
      await Promise.resolve();
    });
    expect(captured).not.toBeNull();
    expect(captured!.mode).toBe('system');
  });

  it('reads the stored override on mount', async () => {
    await AsyncStorage.setItem(__THEME_STORAGE_KEY, 'dark');
    let captured: ReturnType<typeof useThemeMode> | null = null;
    render(
      <ThemeProvider>
        <Probe onReady={(api) => (captured = api)} />
      </ThemeProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(captured!.mode).toBe('dark');
    expect(captured!.resolved).toBe('dark');
    expect(captured!.isDark).toBe(true);
  });

  it('persists setMode to AsyncStorage', async () => {
    let captured: ReturnType<typeof useThemeMode> | null = null;
    render(
      <ThemeProvider initialMode="system">
        <Probe onReady={(api) => (captured = api)} />
      </ThemeProvider>,
    );
    await act(async () => {
      await captured!.setMode('light');
    });
    const stored = await AsyncStorage.getItem(__THEME_STORAGE_KEY);
    expect(stored).toBe('light');
    expect(captured!.mode).toBe('light');
    expect(captured!.resolved).toBe('light');
  });
});
