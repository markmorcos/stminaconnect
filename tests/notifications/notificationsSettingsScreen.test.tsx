/**
 * NotificationsSettingsScreen — verifies that the form loads its
 * initial state from `get_my_servant`, the toggle persists local state,
 * and `update_my_notification_settings` is called with the resolved
 * window when Save is tapped.
 */
/* eslint-disable import/first */
const mockGetPermissions = jest.fn();
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissions(...args),
}));

const mockOpenSettings = jest.fn(async () => {});
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openSettings: mockOpenSettings,
}));

const mockRpc = jest.fn();
jest.mock('@/services/api/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
  missingSupabaseEnvVars: [],
}));

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import NotificationsSettingsScreen from '@/../app/(app)/settings/notifications';
import { ThemeProvider } from '@/design/ThemeProvider';
/* eslint-enable import/first */

function renderScreen() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <PaperProvider>
        <ThemeProvider initialMode="light">
          <NotificationsSettingsScreen />
        </ThemeProvider>
      </PaperProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default permission state — granted; tests override per-case.
  mockGetPermissions.mockResolvedValue({ status: 'granted', granted: true });
});

describe('NotificationsSettingsScreen', () => {
  it('loads initial values from get_my_servant and saves the toggled state', async () => {
    // Initial server state: quiet hours OFF.
    mockRpc.mockImplementation(async (fn: string) => {
      if (fn === 'get_my_servant') {
        return {
          data: {
            language: 'en',
            quiet_hours_enabled: false,
            quiet_hours_start: null,
            quiet_hours_end: null,
          },
          error: null,
        };
      }
      if (fn === 'update_my_notification_settings') {
        return { data: null, error: null };
      }
      return { data: null, error: null };
    });

    const { getByLabelText, getByText } = renderScreen();

    // Wait for the loaded state to populate the form.
    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('get_my_servant'));

    // Toggle quiet hours ON. The Switch's `onValueChange` handler is
    // invoked directly — `fireEvent(switch, 'valueChange', ...)` on
    // RN Testing Library v13 doesn't always reliably propagate a true
    // boolean to the `value` prop closure during the same act flush.
    const toggle = getByLabelText('Enable quiet hours');
    await act(async () => {
      (toggle.props.onValueChange as (v: boolean) => void)(true);
    });

    // Save.
    const saveBtn = getByText('Save');
    await act(async () => {
      fireEvent.press(saveBtn);
    });

    await waitFor(() => {
      const call = mockRpc.mock.calls.find((c) => c[0] === 'update_my_notification_settings');
      expect(call).toBeTruthy();
      expect(call?.[1]).toMatchObject({
        language: null,
        quiet_hours_enabled: true,
        quiet_hours_start: '22:00',
        quiet_hours_end: '07:00',
      });
    });
  });

  it('renders the "Notifications disabled by OS" panel when permission is denied', async () => {
    mockGetPermissions.mockResolvedValueOnce({ status: 'denied', granted: false });
    mockRpc.mockResolvedValue({
      data: {
        language: 'en',
        quiet_hours_enabled: false,
        quiet_hours_start: null,
        quiet_hours_end: null,
      },
      error: null,
    });

    const { findByText } = renderScreen();

    expect(await findByText('Notifications disabled by OS')).toBeTruthy();
    expect(await findByText('Open system settings')).toBeTruthy();
  });
});
