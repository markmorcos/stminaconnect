/**
 * AccountForm — verifies the two sections render, Save is disabled when
 * the display name is unchanged, and validation errors block submission.
 */
/* eslint-disable import/first -- jest.mock() must precede imports */
jest.mock('@/services/api/account', () => ({
  updateMyServant: jest.fn(),
}));

const mockUseAuth = jest.fn();
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider as PaperProvider } from 'react-native-paper';

import { AccountForm } from '@/features/account/AccountForm';
import { ThemeProvider } from '@/design/ThemeProvider';
import { updateMyServant } from '@/services/api/account';
/* eslint-enable import/first */

const baseServant = {
  id: 'servant-1',
  email: 's1@stminaconnect.com',
  display_name: 'Servant One',
  role: 'servant' as const,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deactivated_at: null,
};

function renderForm() {
  return render(
    <PaperProvider>
      <ThemeProvider initialMode="light">
        <AccountForm />
      </ThemeProvider>
    </PaperProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({
    servant: baseServant,
    setServant: jest.fn(),
  });
});

describe('AccountForm', () => {
  it('renders display name and email sections', () => {
    const { getAllByText, getByText, queryByText } = renderForm();
    expect(getAllByText('Display name').length).toBeGreaterThan(0);
    expect(getAllByText('Email').length).toBeGreaterThan(0);
    expect(getByText('Contact an admin to change.')).toBeTruthy();
    expect(queryByText('Change password')).toBeNull();
  });

  it('Save is disabled when the display name is unchanged', async () => {
    (updateMyServant as jest.Mock).mockResolvedValue({
      ...baseServant,
      display_name: 'Servant One',
    });
    const { getByText } = renderForm();
    await act(async () => {
      fireEvent.press(getByText('Save'));
    });
    expect(updateMyServant).not.toHaveBeenCalled();
  });

  it('Save enables when the display name is edited', async () => {
    (updateMyServant as jest.Mock).mockResolvedValue({
      ...baseServant,
      display_name: 'New Name',
    });
    const { getByLabelText, getByText } = renderForm();
    fireEvent.changeText(getByLabelText('Display name'), 'New Name');
    await act(async () => {
      fireEvent.press(getByText('Save'));
    });
    await waitFor(() => {
      expect(updateMyServant).toHaveBeenCalled();
    });
  });

  it('blocks submit and surfaces an error when the field is cleared', async () => {
    const { getByLabelText, getByText, findByText } = renderForm();
    fireEvent.changeText(getByLabelText('Display name'), '   ');
    await act(async () => {
      fireEvent.press(getByText('Save'));
    });
    expect(await findByText('Display name is required')).toBeTruthy();
    expect(updateMyServant).not.toHaveBeenCalled();
  });

  it('calls updateMyServant and dispatches setServant on success', async () => {
    const setServant = jest.fn();
    mockUseAuth.mockReturnValue({ servant: baseServant, setServant });
    (updateMyServant as jest.Mock).mockResolvedValue({
      ...baseServant,
      display_name: 'New Name',
      updated_at: '2026-04-26T00:00:00Z',
    });
    const { getByLabelText, getByText } = renderForm();
    fireEvent.changeText(getByLabelText('Display name'), 'New Name');
    await act(async () => {
      fireEvent.press(getByText('Save'));
    });
    await waitFor(() => {
      expect(updateMyServant).toHaveBeenCalledWith('New Name');
    });
    expect(setServant).toHaveBeenCalledWith({
      display_name: 'New Name',
      updated_at: '2026-04-26T00:00:00Z',
    });
  });
});
