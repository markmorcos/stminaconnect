/**
 * Unit tests for the auth store. Mocks the Supabase client and the
 * servants RPC wrapper so the store logic can be exercised in isolation.
 */
/* eslint-disable import/first -- jest.mock() calls are hoisted by Babel and must precede the imports they replace */
jest.mock('@/services/api/supabase', () => {
  const auth = {
    getSession: jest.fn(),
    signInWithOtp: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChange: jest.fn(),
    exchangeCodeForSession: jest.fn(),
  };
  const functions = { invoke: jest.fn() };
  return { supabase: { auth, functions } };
});

jest.mock('@/services/api/servants', () => ({
  fetchMyServant: jest.fn(),
}));

import { __resetAuthStoreForTests, useAuthStore } from '@/state/authStore';
import { supabase } from '@/services/api/supabase';
/* eslint-enable import/first */

const mockedAuth = supabase.auth as unknown as Record<string, jest.Mock>;
const mockedFunctions = supabase.functions as unknown as { invoke: jest.Mock };

const SESSION = { access_token: 't', user: { id: 'u1', email: 'a@b' } } as any;
const SERVANT = {
  id: 'u1',
  email: 'a@b',
  display_name: 'Anba',
  role: 'admin' as const,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deactivated_at: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  __resetAuthStoreForTests();
});

describe('authStore.signInWithMagicLink', () => {
  beforeEach(() => {
    // Default: review-login probe returns null for every email, so all
    // existing tests fall through to signInWithOtp unchanged. Reviewer
    // tests below override this for the matching email.
    mockedFunctions.invoke.mockResolvedValue({ data: { link: null }, error: null });
  });

  it('clears error on success', async () => {
    mockedAuth.signInWithOtp.mockResolvedValue({ data: {}, error: null });
    await useAuthStore.getState().signInWithMagicLink('a@b', 'exp://redirect');
    expect(mockedAuth.signInWithOtp).toHaveBeenCalledWith({
      email: 'a@b',
      options: { emailRedirectTo: 'exp://redirect', shouldCreateUser: false },
    });
    expect(useAuthStore.getState().error).toBeNull();
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('maps rate-limit errors to the localized message', async () => {
    mockedAuth.signInWithOtp.mockResolvedValue({
      data: {},
      error: {
        name: 'AuthApiError',
        message: 'rate limited',
        status: 429,
        code: 'over_email_send_rate_limit',
      },
    });
    await useAuthStore.getState().signInWithMagicLink('a@b');
    expect(useAuthStore.getState().error).toBe('Too many attempts. Try again in a moment.');
  });

  it('maps fetch failures to the offline message', async () => {
    mockedAuth.signInWithOtp.mockResolvedValue({
      data: {},
      error: { name: 'AuthRetryableFetchError', message: 'fetch failed' },
    });
    await useAuthStore.getState().signInWithMagicLink('a@b');
    expect(useAuthStore.getState().error).toBe(
      "Couldn't reach the server. Check your connection and try again.",
    );
  });

  describe('reviewer-bypass probe', () => {
    it('falls through to signInWithOtp when review-login returns null link', async () => {
      mockedFunctions.invoke.mockResolvedValue({ data: { link: null }, error: null });
      mockedAuth.signInWithOtp.mockResolvedValue({ data: {}, error: null });

      await useAuthStore.getState().signInWithMagicLink('real-user@stminaconnect.com', 'exp://r');

      expect(mockedFunctions.invoke).toHaveBeenCalledWith('review-login', {
        body: { email: 'real-user@stminaconnect.com', redirectTo: 'exp://r' },
      });
      expect(mockedAuth.signInWithOtp).toHaveBeenCalledTimes(1);
      expect(useAuthStore.getState().reviewLink).toBeNull();
    });

    it('falls through to signInWithOtp when review-login throws (graceful degradation)', async () => {
      // Suppress the dev-only console.warn the auth store emits on probe failure.
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      mockedFunctions.invoke.mockRejectedValue(new Error('function unavailable'));
      mockedAuth.signInWithOtp.mockResolvedValue({ data: {}, error: null });

      await useAuthStore.getState().signInWithMagicLink('real-user@stminaconnect.com');

      expect(mockedAuth.signInWithOtp).toHaveBeenCalledTimes(1);
      expect(useAuthStore.getState().reviewLink).toBeNull();
      expect(useAuthStore.getState().error).toBeNull();
      warnSpy.mockRestore();
    });

    it('surfaces the link and skips signInWithOtp when review-login returns a non-null link', async () => {
      mockedFunctions.invoke.mockResolvedValue({
        data: { link: 'https://example.supabase.co/auth/v1/verify?token=abc' },
        error: null,
      });

      await useAuthStore.getState().signInWithMagicLink('playreview-7f3a9c2d@stminaconnect.app');

      expect(mockedAuth.signInWithOtp).not.toHaveBeenCalled();
      expect(useAuthStore.getState().reviewLink).toBe(
        'https://example.supabase.co/auth/v1/verify?token=abc',
      );
      expect(useAuthStore.getState().isLoading).toBe(false);
      expect(useAuthStore.getState().error).toBeNull();
    });

    it('clearReviewLink resets the dialog state', () => {
      useAuthStore.setState({ reviewLink: 'https://x' });
      useAuthStore.getState().clearReviewLink();
      expect(useAuthStore.getState().reviewLink).toBeNull();
    });
  });
});

describe('authStore.signOut', () => {
  it('clears session and servant', async () => {
    useAuthStore.setState({ session: SESSION, servant: SERVANT, isLoading: false, error: null });
    mockedAuth.signOut.mockResolvedValue({ error: null });

    await useAuthStore.getState().signOut();

    const state = useAuthStore.getState();
    expect(state.session).toBeNull();
    expect(state.servant).toBeNull();
    expect(state.error).toBeNull();
  });
});
