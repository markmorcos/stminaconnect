/**
 * Settings → Privacy screen — exercises the typed-confirmation gate on
 * the "Delete my account" action.
 */
/* eslint-disable import/first -- jest.mock() must precede imports */
jest.mock('@/services/api/compliance', () => ({
  exportMyData: jest.fn(),
  eraseMyAccount: jest.fn(async () => undefined),
  listMyConsentHistory: jest.fn(async () => []),
}));

const mockSignOut = jest.fn();
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    servant: {
      id: 'u1',
      email: 's1@stmina.de',
      display_name: 'Maryam Saad',
      role: 'servant',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      deactivated_at: null,
    },
    signOut: mockSignOut,
  }),
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import PrivacyScreen from '@/../app/(app)/settings/privacy';
import { ThemeProvider } from '@/design/ThemeProvider';
import { eraseMyAccount } from '@/services/api/compliance';
/* eslint-enable import/first */

function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PaperProvider>
        <ThemeProvider initialMode="light">
          <PrivacyScreen />
        </ThemeProvider>
      </PaperProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Privacy screen — Delete my account', () => {
  it('does not call erase_my_account until the typed name matches exactly', async () => {
    const utils = renderScreen();
    const { getAllByText, getByLabelText } = utils;

    // Open the modal — there are two "Delete my account" elements (heading
    // + button); pick the last (the actual button).
    const deleteButtons = getAllByText('Delete my account');
    fireEvent.press(deleteButtons[deleteButtons.length - 1]);

    const input = await waitFor(() => getByLabelText('Type your name'));
    fireEvent.changeText(input, 'Maryam'); // incomplete

    const confirmButtons = getAllByText('Delete');
    fireEvent.press(confirmButtons[confirmButtons.length - 1]);
    expect(eraseMyAccount).not.toHaveBeenCalled();

    fireEvent.changeText(input, 'Maryam Saad');
    fireEvent.press(confirmButtons[confirmButtons.length - 1]);
    await waitFor(() => expect(eraseMyAccount).toHaveBeenCalled());
    expect(mockSignOut).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/sign-in');
  });
});
