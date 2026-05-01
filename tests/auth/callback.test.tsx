/**
 * Auth callback screen — verifies that the PKCE code-exchange path is
 * bounded by a 10-second timeout. When `exchangeCodeForSession` never
 * resolves (the missing-code-verifier scenario after a reinstall), the
 * screen MUST end up redirecting to /sign-in within the timeout window
 * rather than spinning indefinitely.
 */
/* eslint-disable import/first */
const mockExchange: jest.Mock = jest.fn();
const mockSetSession: jest.Mock = jest.fn();
const mockGetInitialURL: jest.Mock<Promise<string | null>, []> = jest.fn();
const mockAddEventListener: jest.Mock = jest.fn(() => ({ remove: jest.fn() }));

jest.mock('@/services/api/supabase', () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: mockExchange,
      setSession: mockSetSession,
    },
  },
}));

jest.mock('expo-linking', () => ({
  parse: (url: string) => {
    const qIdx = url.indexOf('?');
    if (qIdx === -1) return { queryParams: {} };
    const params = new URLSearchParams(url.slice(qIdx + 1));
    return { queryParams: Object.fromEntries(params.entries()) };
  },
  getInitialURL: () => mockGetInitialURL(),
  addEventListener: (event: string, cb: unknown) => mockAddEventListener(event, cb),
}));

const mockRedirect: jest.Mock = jest.fn(() => null);
jest.mock('expo-router', () => ({
  Redirect: (props: { href: string }) => {
    mockRedirect(props.href);
    return null;
  },
}));

import { act, render, waitFor } from '@testing-library/react-native';

import AuthCallback from '@/../app/auth/callback';
import { ThemeProvider } from '@/design/ThemeProvider';
/* eslint-enable import/first */

function renderScreen() {
  return render(
    <ThemeProvider initialMode="light">
      <AuthCallback />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AuthCallback', () => {
  it('redirects to /sign-in when exchangeCodeForSession never resolves (missing code verifier)', async () => {
    jest.useFakeTimers();
    mockGetInitialURL.mockResolvedValue('stminaconnect://auth/callback?code=ABC123');
    // Simulate a hung exchange — the supabase-js call never settles.
    mockExchange.mockReturnValue(new Promise(() => {}));

    renderScreen();

    // Allow the initial-URL promise to flush so consume() registers the
    // race against the timer.
    await act(async () => {
      await Promise.resolve();
    });

    // Advance past the 10-second wall-clock cap.
    await act(async () => {
      jest.advanceTimersByTime(10_000);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockRedirect).toHaveBeenCalledWith('/sign-in');
    });
    jest.useRealTimers();
  });

  it('redirects to /sign-in when no auth payload is on the URL', async () => {
    mockGetInitialURL.mockResolvedValue('stminaconnect://auth/callback');
    renderScreen();

    await waitFor(() => {
      expect(mockRedirect).toHaveBeenCalledWith('/sign-in');
    });
  });
});
