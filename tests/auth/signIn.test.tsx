/**
 * Sign-in screen — single mode (magic link). Asserts no password input,
 * no OTP input, and that the post-submit "check your inbox" empty-state
 * exposes resend + use-different-email links that drive the right
 * behaviours. The reviewer-bypass path skips this screen entirely (the
 * auth gate redirects on session change), so its behaviour is covered
 * by `authStore.test.ts` rather than here.
 */
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import SignInScreen from '@/../app/(auth)/sign-in';
import { ThemeProvider } from '@/design/ThemeProvider';

const mockSignInWithMagicLink = jest.fn();
let mockReviewerJustSignedIn = false;

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    session: null,
    servant: null,
    isLoading: false,
    error: null,
    reviewerJustSignedIn: mockReviewerJustSignedIn,
    signInWithMagicLink: mockSignInWithMagicLink,
    signOut: jest.fn(),
    clearReviewerJustSignedIn: jest.fn(),
  }),
}));

// The screen reads `reviewerJustSignedIn` from the store directly after
// the sign-in action awaits, to decide whether to skip the "check your
// inbox" transition. Mirror it here.
jest.mock('@/state/authStore', () => ({
  useAuthStore: {
    getState: () => ({ reviewerJustSignedIn: mockReviewerJustSignedIn }),
  },
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
    mockSignInWithMagicLink.mockReset();
    mockReviewerJustSignedIn = false;
  });

  it('renders email field and Send button only — no password, no OTP, no mode toggle', () => {
    const { getByText, getByLabelText, queryByLabelText, queryByText } = renderScreen();
    expect(getByText('Welcome')).toBeTruthy();
    expect(getByLabelText('Email')).toBeTruthy();
    expect(getByText('Send magic link')).toBeTruthy();
    expect(queryByLabelText('Password')).toBeNull();
    expect(queryByLabelText('6-digit code')).toBeNull();
    expect(queryByText('Email me a code instead')).toBeNull();
    expect(queryByText('Use email and password instead')).toBeNull();
  });

  it('submits the email to signInWithMagicLink with the redirect URL', async () => {
    mockSignInWithMagicLink.mockResolvedValue(undefined);
    const { getByLabelText, getByText } = renderScreen();
    fireEvent.changeText(getByLabelText('Email'), 'volunteer@stminaconnect.com');
    await act(async () => {
      fireEvent.press(getByText('Send magic link'));
    });
    await waitFor(() =>
      expect(mockSignInWithMagicLink).toHaveBeenCalledWith(
        'volunteer@stminaconnect.com',
        'exp://test/--/auth/callback',
      ),
    );
  });

  it('after submit, shows the "check your inbox" empty-state with resend + use-different-email', async () => {
    mockSignInWithMagicLink.mockResolvedValue(undefined);
    const { getByLabelText, getByText, findByText, queryByLabelText } = renderScreen();
    fireEvent.changeText(getByLabelText('Email'), 'volunteer@stminaconnect.com');
    await act(async () => {
      fireEvent.press(getByText('Send magic link'));
    });

    expect(await findByText(/We sent a sign-in link to volunteer@stminaconnect.com/i)).toBeTruthy();
    expect(getByText("Didn't receive it? Send again")).toBeTruthy();
    expect(getByText('Use a different email')).toBeTruthy();
    expect(queryByLabelText('Email')).toBeNull();
  });

  it('"Use a different email" returns to the email form', async () => {
    mockSignInWithMagicLink.mockResolvedValue(undefined);
    const { getByLabelText, getByText, findByText } = renderScreen();
    fireEvent.changeText(getByLabelText('Email'), 'volunteer@stminaconnect.com');
    await act(async () => {
      fireEvent.press(getByText('Send magic link'));
    });
    await findByText(/We sent a sign-in link/i);

    await act(async () => {
      fireEvent.press(getByText('Use a different email'));
    });
    expect(getByLabelText('Email')).toBeTruthy();
    expect(getByText('Send magic link')).toBeTruthy();
  });

  it('skips the "check your inbox" transition when the reviewer-bypass auto-signed in', async () => {
    // Simulate the auth store flipping the flag during signInWithMagicLink
    // (the real store does this synchronously on a verifyOtp success).
    mockSignInWithMagicLink.mockImplementation(async () => {
      mockReviewerJustSignedIn = true;
    });
    const { getByLabelText, getByText, queryByText } = renderScreen();
    fireEvent.changeText(getByLabelText('Email'), 'playreview-7f3a9c2d@stminaconnect.app');
    await act(async () => {
      fireEvent.press(getByText('Send magic link'));
    });
    // No inbox empty-state, no link-sent snackbar — the auth gate is
    // about to redirect away from this screen.
    expect(queryByText(/We sent a sign-in link/i)).toBeNull();
    expect(getByLabelText('Email')).toBeTruthy();
  });

  it('resend re-invokes signInWithMagicLink with the same email', async () => {
    mockSignInWithMagicLink.mockResolvedValue(undefined);
    const { getByLabelText, getByText, findByText } = renderScreen();
    fireEvent.changeText(getByLabelText('Email'), 'volunteer@stminaconnect.com');
    await act(async () => {
      fireEvent.press(getByText('Send magic link'));
    });
    await findByText(/We sent a sign-in link/i);

    mockSignInWithMagicLink.mockClear();
    await act(async () => {
      fireEvent.press(getByText("Didn't receive it? Send again"));
    });
    await waitFor(() =>
      expect(mockSignInWithMagicLink).toHaveBeenCalledWith(
        'volunteer@stminaconnect.com',
        'exp://test/--/auth/callback',
      ),
    );
  });
});
