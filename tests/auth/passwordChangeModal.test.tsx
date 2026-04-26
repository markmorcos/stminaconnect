/**
 * PasswordChangeModal — exercises the validation matrix and the
 * verify-then-update submit pipeline.
 */
/* eslint-disable import/first */
jest.mock('@/services/api/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      updateUser: jest.fn(),
    },
  },
}));

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider as PaperProvider } from 'react-native-paper';

import { PasswordChangeModal } from '@/features/account/PasswordChangeModal';
import { ThemeProvider } from '@/design/ThemeProvider';
import { supabase } from '@/services/api/supabase';
/* eslint-enable import/first */

const auth = supabase.auth as unknown as Record<string, jest.Mock>;

function renderModal(overrides: Partial<React.ComponentProps<typeof PasswordChangeModal>> = {}) {
  const onSuccess = jest.fn();
  const onDismiss = jest.fn();
  const utils = render(
    <PaperProvider>
      <ThemeProvider initialMode="light">
        <PasswordChangeModal
          visible
          email="s1@stmina.de"
          onSuccess={onSuccess}
          onDismiss={onDismiss}
          {...overrides}
        />
      </ThemeProvider>
    </PaperProvider>,
  );
  return { ...utils, onSuccess, onDismiss };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PasswordChangeModal', () => {
  it('blocks submit when new password is too short', async () => {
    const { getByLabelText, getAllByText, findByText } = renderModal();
    fireEvent.changeText(getByLabelText('Current password'), 'oldPass123');
    fireEvent.changeText(getByLabelText('New password'), 'short');
    fireEvent.changeText(getByLabelText('Confirm new password'), 'short');
    await act(async () => {
      // Modal renders Save twice (its own + nothing else here); pick the first.
      fireEvent.press(getAllByText('Save')[0]);
    });
    expect(await findByText('New password must be at least 8 characters')).toBeTruthy();
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('blocks submit when new == current', async () => {
    const { getByLabelText, getAllByText, findByText } = renderModal();
    fireEvent.changeText(getByLabelText('Current password'), 'samePass1');
    fireEvent.changeText(getByLabelText('New password'), 'samePass1');
    fireEvent.changeText(getByLabelText('Confirm new password'), 'samePass1');
    await act(async () => {
      fireEvent.press(getAllByText('Save')[0]);
    });
    expect(await findByText('New password must differ from the current one')).toBeTruthy();
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('blocks submit when confirm != new', async () => {
    const { getByLabelText, getAllByText, findByText } = renderModal();
    fireEvent.changeText(getByLabelText('Current password'), 'oldPass123');
    fireEvent.changeText(getByLabelText('New password'), 'newPass456');
    fireEvent.changeText(getByLabelText('Confirm new password'), 'newPass789');
    await act(async () => {
      fireEvent.press(getAllByText('Save')[0]);
    });
    expect(await findByText('Passwords do not match')).toBeTruthy();
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('verifies current then updates on success', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: 't' } },
      error: null,
    });
    auth.updateUser.mockResolvedValue({ data: {}, error: null });

    const { getByLabelText, getAllByText, onSuccess } = renderModal();
    fireEvent.changeText(getByLabelText('Current password'), 'oldPass123');
    fireEvent.changeText(getByLabelText('New password'), 'newPass456');
    fireEvent.changeText(getByLabelText('Confirm new password'), 'newPass456');

    await act(async () => {
      fireEvent.press(getAllByText('Save')[0]);
    });

    await waitFor(() => {
      expect(auth.signInWithPassword).toHaveBeenCalledWith({
        email: 's1@stmina.de',
        password: 'oldPass123',
      });
    });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'newPass456' });
    expect(onSuccess).toHaveBeenCalled();
  });

  it('surfaces inline error when current password is wrong', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { name: 'AuthApiError', message: 'invalid', status: 400, code: 'invalid_credentials' },
    });

    const { getByLabelText, getAllByText, findByText } = renderModal();
    fireEvent.changeText(getByLabelText('Current password'), 'wrongPass');
    fireEvent.changeText(getByLabelText('New password'), 'newPass456');
    fireEvent.changeText(getByLabelText('Confirm new password'), 'newPass456');
    await act(async () => {
      fireEvent.press(getAllByText('Save')[0]);
    });

    expect(await findByText('Current password is incorrect')).toBeTruthy();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});
