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
  return { supabase: { auth } };
});

jest.mock('@/services/api/servants', () => ({
  fetchMyServant: jest.fn(),
}));

import { __resetAuthStoreForTests, useAuthStore } from '@/state/authStore';
import { supabase } from '@/services/api/supabase';
/* eslint-enable import/first */

const mockedAuth = supabase.auth as unknown as Record<string, jest.Mock>;

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
