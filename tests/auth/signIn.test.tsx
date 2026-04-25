/**
 * Sign-in screen renders both modes; submitting forwards form values
 * to the appropriate store action.
 */
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import SignInScreen from '@/../app/(auth)/sign-in';
import { ThemeProvider } from '@/design/ThemeProvider';

const mockSignIn = jest.fn();
const mockSignInWithMagicLink = jest.fn();
const mockVerifyEmailOtp = jest.fn();

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    session: null,
    servant: null,
    isLoading: false,
    error: null,
    signIn: mockSignIn,
    signInWithMagicLink: mockSignInWithMagicLink,
    verifyEmailOtp: mockVerifyEmailOtp,
    signOut: jest.fn(),
  }),
}));

jest.mock('expo-linking', () => ({
  createURL: (path: string) => `exp://test/--${path}`,
}));

function renderScreen() {
  return render(
    <ThemeProvider initialMode="light">
      <SignInScreen />
    </ThemeProvider>,
  );
}

describe('Sign-in screen', () => {
  beforeEach(() => {
    mockSignIn.mockReset();
    mockSignInWithMagicLink.mockReset();
    mockVerifyEmailOtp.mockReset();
  });

  it('renders password mode by default with email + password fields', () => {
    const { getByText, getByLabelText } = renderScreen();
    expect(getByText('Welcome')).toBeTruthy();
    expect(getByText('Sign in')).toBeTruthy();
    expect(getByLabelText('Email')).toBeTruthy();
    expect(getByLabelText('Password')).toBeTruthy();
  });

  it('toggles to email-code mode and back', () => {
    const { getByText, queryByLabelText } = renderScreen();
    fireEvent.press(getByText('Email me a code instead'));
    expect(queryByLabelText('Password')).toBeNull();
    expect(getByText('Send code')).toBeTruthy();
    fireEvent.press(getByText('Use email and password instead'));
    expect(queryByLabelText('Password')).toBeTruthy();
  });

  it('submits password form with form values', async () => {
    mockSignIn.mockResolvedValue(undefined);
    const { getByLabelText, getByText } = renderScreen();
    fireEvent.changeText(getByLabelText('Email'), 'priest@stmina.de');
    fireEvent.changeText(getByLabelText('Password'), 'correctPassword!');
    await act(async () => {
      fireEvent.press(getByText('Sign in'));
    });
    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith('priest@stmina.de', 'correctPassword!'),
    );
  });

  it('sends the code, then verifies the entered OTP', async () => {
    mockSignInWithMagicLink.mockResolvedValue(undefined);
    mockVerifyEmailOtp.mockResolvedValue(undefined);
    const { getByLabelText, getByText, findByLabelText } = renderScreen();

    fireEvent.press(getByText('Email me a code instead'));
    fireEvent.changeText(getByLabelText('Email'), 'volunteer@stmina.de');
    await act(async () => {
      fireEvent.press(getByText('Send code'));
    });
    await waitFor(() =>
      expect(mockSignInWithMagicLink).toHaveBeenCalledWith(
        'volunteer@stmina.de',
        'exp://test/--/auth/callback',
      ),
    );

    const codeInput = await findByLabelText('6-digit code');
    fireEvent.changeText(codeInput, '123456');
    await act(async () => {
      fireEvent.press(getByText('Verify'));
    });
    await waitFor(() =>
      expect(mockVerifyEmailOtp).toHaveBeenCalledWith('volunteer@stmina.de', '123456'),
    );
  });
});
