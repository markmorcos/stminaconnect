/**
 * Component test for the sync status indicator. Drives state through
 * `useSyncState` and asserts the rendered icon color + queue badge.
 */
/* eslint-disable import/first */
jest.mock('@/services/sync/SyncEngine', () => {
  const { create } = jest.requireActual<typeof import('zustand')>('zustand');
  const useSyncState = create((set: (s: Record<string, unknown>) => void) => ({
    status: 'idle',
    queueLength: 0,
    lastPullAt: null,
    lastError: null,
    hasCompletedFirstPull: true,
    conflictedPersonName: null,
    setStatus: (status: string) => set({ status }),
    setQueueLength: (queueLength: number) => set({ queueLength }),
    setLastPullAt: (lastPullAt: string | null) => set({ lastPullAt }),
    setLastError: (lastError: string | null) => set({ lastError }),
    setHasCompletedFirstPull: (v: boolean) => set({ hasCompletedFirstPull: v }),
    setConflictedPersonName: (n: string | null) => set({ conflictedPersonName: n }),
  }));
  return {
    useSyncState,
    getSyncEngine: () => ({ runOnce: jest.fn().mockResolvedValue(undefined) }),
  };
});

import { act, render } from '@testing-library/react-native';
import { Provider as PaperProvider } from 'react-native-paper';

import { SyncStatusIndicator } from '@/components/SyncStatusIndicator';
import { ThemeProvider } from '@/design/ThemeProvider';
import { useSyncState } from '@/services/sync/SyncEngine';
/* eslint-enable import/first */

function renderIndicator() {
  return render(
    <PaperProvider>
      <ThemeProvider initialMode="light">
        <SyncStatusIndicator />
      </ThemeProvider>
    </PaperProvider>,
  );
}

describe('SyncStatusIndicator', () => {
  beforeEach(() => {
    act(() => {
      useSyncState.setState({
        status: 'idle',
        queueLength: 0,
        hasCompletedFirstPull: true,
      });
    });
  });

  it('renders nothing when idle and no recent transition (auto-hide)', () => {
    const { queryByText } = renderIndicator();
    // PaperProvider wraps in chrome (SafeAreaProvider, etc.), so we
    // assert the bar's own copy is absent rather than the whole tree
    // being null.
    expect(queryByText('Syncing…')).toBeNull();
    expect(queryByText('Synced')).toBeNull();
    expect(queryByText(/waiting to sync/i)).toBeNull();
  });

  it('shows the busy bar with a count while pulling/pushing with pending ops', () => {
    act(() => {
      useSyncState.setState({ status: 'pushing', queueLength: 3 });
    });
    const { getByText } = renderIndicator();
    expect(getByText('Syncing 3 changes…')).toBeTruthy();
  });

  it('shows a pending bar while offline with queued ops', () => {
    act(() => {
      useSyncState.setState({ status: 'offline', queueLength: 5 });
    });
    const { getByText } = renderIndicator();
    expect(getByText('5 changes waiting to sync')).toBeTruthy();
  });

  it('flashes a green "Synced" pulse on the busy → idle transition', () => {
    jest.useFakeTimers();
    try {
      act(() => {
        useSyncState.setState({ status: 'pushing', queueLength: 2 });
      });
      const { getByText, queryByText, rerender } = renderIndicator();
      expect(getByText('Syncing 2 changes…')).toBeTruthy();

      // Drain: queue → 0, status → idle.
      act(() => {
        useSyncState.setState({ status: 'idle', queueLength: 0 });
      });
      rerender(
        <PaperProvider>
          <ThemeProvider initialMode="light">
            <SyncStatusIndicator />
          </ThemeProvider>
        </PaperProvider>,
      );
      expect(getByText('Synced')).toBeTruthy();

      // After the pulse interval, the bar disappears.
      act(() => {
        jest.advanceTimersByTime(2_100);
      });
      rerender(
        <PaperProvider>
          <ThemeProvider initialMode="light">
            <SyncStatusIndicator />
          </ThemeProvider>
        </PaperProvider>,
      );
      expect(queryByText('Synced')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});
