/**
 * Servants management screen — Section 11.5.
 *
 *   - Renders the list with role + active state badges, "Invite servant"
 *     button, and per-row promote/deactivate actions.
 *   - Tapping "Invite servant" opens the modal with the three fields.
 *   - Tapping "Send invite" calls `inviteServant` with the typed values
 *     and surfaces the success snack.
 *   - A deactivated row exposes "Reactivate" instead of Promote /
 *     Deactivate.
 */
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ServantsScreen } from '@/features/admin/ServantsScreen';
import { ThemeProvider } from '@/design/ThemeProvider';

jest.mock('expo-linking', () => ({
  createURL: (path: string) => `exp://test/--${path}`,
}));

const mockListAll = jest.fn();
const mockInvite = jest.fn();
const mockUpdateRole = jest.fn();
const mockDeactivate = jest.fn();
const mockReactivate = jest.fn();

jest.mock('@/services/api/adminServants', () => {
  class AdminInviteError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
  return {
    AdminInviteError,
    listAllServants: () => mockListAll(),
    inviteServant: (...args: unknown[]) => mockInvite(...args),
    updateServantRole: (...args: unknown[]) => mockUpdateRole(...args),
    deactivateServant: (...args: unknown[]) => mockDeactivate(...args),
    reactivateServant: (...args: unknown[]) => mockReactivate(...args),
  };
});

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PaperProvider>
        <ThemeProvider initialMode="light">
          <ServantsScreen />
        </ThemeProvider>
      </PaperProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockListAll.mockReset();
  mockInvite.mockReset();
  mockUpdateRole.mockReset();
  mockDeactivate.mockReset();
  mockReactivate.mockReset();
});

describe('Servants screen', () => {
  it('renders the list with role + state badges and per-row actions', async () => {
    mockListAll.mockResolvedValue([
      {
        id: 'a1',
        email: 'admin@stmina.test',
        display_name: 'Priest Mark',
        role: 'admin',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        deactivated_at: null,
      },
      {
        id: 's1',
        email: 'servant@stmina.test',
        display_name: 'Mariam Habib',
        role: 'servant',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        deactivated_at: null,
      },
      {
        id: 'd1',
        email: 'old@stmina.test',
        display_name: 'Retired',
        role: 'servant',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        deactivated_at: '2026-02-01',
      },
    ]);

    const { findByText, getAllByText, getByText } = renderScreen();
    expect(await findByText('Priest Mark')).toBeTruthy();
    expect(getByText('Mariam Habib')).toBeTruthy();
    expect(getByText('Retired')).toBeTruthy();

    // Active rows have Promote/Demote + Deactivate; deactivated row has Reactivate.
    expect(getAllByText('Deactivate').length).toBe(2);
    expect(getByText('Demote to servant')).toBeTruthy();
    expect(getByText('Promote to admin')).toBeTruthy();
    expect(getByText('Reactivate')).toBeTruthy();
  });

  it('opens the invite modal and submits with the typed values', async () => {
    mockListAll.mockResolvedValue([]);
    mockInvite.mockResolvedValue({
      id: 'new',
      email: 'new@stmina.test',
      display_name: 'New One',
      role: 'servant',
      created_at: '2026-04-01',
      updated_at: '2026-04-01',
      deactivated_at: null,
    });

    const { findByText, getByLabelText, getByText } = renderScreen();
    fireEvent.press(await findByText('Invite servant'));

    fireEvent.changeText(getByLabelText('Email'), 'new@stmina.test');
    fireEvent.changeText(getByLabelText('Display name'), 'New One');
    fireEvent.press(getByText('Send invite'));

    await waitFor(() =>
      expect(mockInvite).toHaveBeenCalledWith({
        email: 'new@stmina.test',
        displayName: 'New One',
        role: 'servant',
        redirectTo: 'exp://test/--/auth/callback',
      }),
    );
    expect(await findByText('Invite sent.')).toBeTruthy();
  });
});
