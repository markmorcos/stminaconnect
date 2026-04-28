/**
 * Accessibility preferences — persisted user-level toggles.
 *
 *   - `hapticsEnabled` (default: true): gates the `haptics.*` helpers.
 *     When off, every haptic call is a no-op. Default-on matches the
 *     iOS / Android system convention for tactile feedback.
 *
 * Persisted via AsyncStorage with the key `@stmina/a11y-prefs`. The
 * settings screen mutates the store; `src/utils/haptics.ts` reads
 * via `useAccessibilityStore.getState()` so the helpers stay
 * synchronous (no React tree dependency).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = '@stmina/a11y-prefs';

interface PersistedShape {
  hapticsEnabled: boolean;
}

export interface AccessibilityState extends PersistedShape {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setHapticsEnabled: (value: boolean) => void;
}

export const useAccessibilityStore = create<AccessibilityState>((set, get) => ({
  hapticsEnabled: true,
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedShape>;
        set({
          hapticsEnabled: parsed.hapticsEnabled ?? true,
          hydrated: true,
        });
        return;
      }
    } catch {
      // Fallthrough — keep defaults if storage is corrupted.
    }
    set({ hydrated: true });
  },
  setHapticsEnabled: (value) => {
    set({ hapticsEnabled: value });
    void AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ hapticsEnabled: value } satisfies PersistedShape),
    ).catch(() => {
      // Best-effort write — the in-memory state already reflects the toggle.
    });
  },
}));

/** Test-only helper to reset the singleton between tests. */
export function __resetAccessibilityStoreForTests(): void {
  useAccessibilityStore.setState({ hapticsEnabled: true, hydrated: false });
}
