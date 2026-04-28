/**
 * Admin Compliance — verifies the erase confirmation requires:
 *   - the typed name to match the person's full name exactly,
 *   - a reason of at least 20 characters.
 */
/* eslint-disable import/first -- jest.mock() must precede imports */
jest.mock('@/services/api/compliance', () => ({
  exportPersonData: jest.fn(),
  erasePersonData: jest.fn(async () => undefined),
  listAuditLog: jest.fn(async () => []),
}));

jest.mock('@/services/api/persons', () => ({
  listPersons: jest.fn(async () => [
    {
      id: 'p1',
      first_name: 'Mariam',
      last_name: 'Saad',
      phone: null,
      region: null,
      language: 'en' as const,
      priority: 'medium' as const,
      assigned_servant: 'a1',
      comments: null,
      status: 'active' as const,
      paused_until: null,
      registration_type: 'full' as const,
      registered_by: 'a1',
      registered_at: '2026-01-01T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      deleted_at: null,
    },
  ]),
}));

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import AdminComplianceScreen from '@/../app/(app)/admin/compliance';
import { ThemeProvider } from '@/design/ThemeProvider';
import { erasePersonData } from '@/services/api/compliance';
/* eslint-enable import/first */

function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PaperProvider>
        <ThemeProvider initialMode="light">
          <AdminComplianceScreen />
        </ThemeProvider>
      </PaperProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Admin compliance — erase gating', () => {
  it('requires the typed name AND a reason of ≥ 20 characters', async () => {
    const { getByLabelText, getByText, getAllByText } = renderScreen();

    // Search for the person.
    const search = getByLabelText('Search a member by name');
    fireEvent.changeText(search, 'Mariam');

    await waitFor(() => expect(getByText('Mariam Saad')).toBeTruthy());

    // Open erase dialog.
    fireEvent.press(getAllByText('Erase data')[0]);

    const nameInput = await waitFor(() => getByLabelText('Type "Mariam Saad"'));
    const reasonInput = getByLabelText('Reason (≥ 20 characters)');

    // Wrong name + valid reason — disabled.
    fireEvent.changeText(nameInput, 'Mariam');
    fireEvent.changeText(reasonInput, 'GDPR Article 17 request 2026-04-28');
    const confirmButtons = getAllByText('Erase');
    fireEvent.press(confirmButtons[confirmButtons.length - 1]);
    expect(erasePersonData).not.toHaveBeenCalled();

    // Correct name + short reason — disabled.
    fireEvent.changeText(nameInput, 'Mariam Saad');
    fireEvent.changeText(reasonInput, 'short');
    fireEvent.press(confirmButtons[confirmButtons.length - 1]);
    expect(erasePersonData).not.toHaveBeenCalled();

    // Correct name + valid reason — fires.
    fireEvent.changeText(reasonInput, 'GDPR Article 17 request 2026-04-28');
    fireEvent.press(confirmButtons[confirmButtons.length - 1]);
    await waitFor(() =>
      expect(erasePersonData).toHaveBeenCalledWith('p1', 'GDPR Article 17 request 2026-04-28'),
    );
  });
});
