import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '@/services/api/supabase';
import { fetchMyServant, type ServantRow } from '@/services/api/servants';

export interface AuthState {
  session: Session | null;
  servant: ServantRow | null;
  /**
   * True until the very first `refresh()` call settles. Layouts gate
   * their initial redirect on this so they don't flash the wrong screen
   * before we know if there's a persisted session.
   */
  isHydrated: boolean;
  /**
   * True while an action (signIn / verifyEmailOtp / signOut / …) is
   * in flight. Screens use this to disable buttons; layouts MUST NOT
   * gate on it (toggling it during a sign-in would otherwise unmount
   * the screen and lose its local form state).
   */
  isLoading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithMagicLink: (email: string, redirectTo?: string) => Promise<void>;
  verifyEmailOtp: (email: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const ORPHAN_ERROR = 'Account not configured. Contact your admin.';

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  servant: null,
  isHydrated: false,
  isLoading: false,
  error: null,

  async refresh() {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      set({ session: null, servant: null, isHydrated: true, error: error.message });
      return;
    }
    const session = data.session;
    if (!session) {
      set({ session: null, servant: null, isHydrated: true, error: null });
      return;
    }
    try {
      const servant = await fetchMyServant();
      if (!servant) {
        await supabase.auth.signOut();
        set({ session: null, servant: null, isHydrated: true, error: ORPHAN_ERROR });
        return;
      }
      set({ session, servant, isHydrated: true, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load servant profile';
      set({ session, servant: null, isHydrated: true, error: message });
    }
  },

  async signIn(email, password) {
    set({ isLoading: true, error: null });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      set({
        isLoading: false,
        error: error?.message ?? 'Sign-in failed',
        session: null,
        servant: null,
      });
      return;
    }
    try {
      const servant = await fetchMyServant();
      if (!servant) {
        await supabase.auth.signOut();
        set({ session: null, servant: null, isLoading: false, error: ORPHAN_ERROR });
        return;
      }
      set({ session: data.session, servant, isLoading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load servant profile';
      await supabase.auth.signOut();
      set({ session: null, servant: null, isLoading: false, error: message });
    }
  },

  async signInWithMagicLink(email, redirectTo) {
    set({ isLoading: true, error: null });
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: false,
      },
    });
    if (error) {
      set({ isLoading: false, error: error.message });
      return;
    }
    set({ isLoading: false, error: null });
  },

  async verifyEmailOtp(email, token) {
    set({ isLoading: true, error: null });
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    if (error || !data.session) {
      set({ isLoading: false, error: error?.message ?? 'Invalid or expired code' });
      return;
    }
    try {
      const servant = await fetchMyServant();
      if (!servant) {
        await supabase.auth.signOut();
        set({ session: null, servant: null, isLoading: false, error: ORPHAN_ERROR });
        return;
      }
      set({ session: data.session, servant, isLoading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load servant profile';
      await supabase.auth.signOut();
      set({ session: null, servant: null, isLoading: false, error: message });
    }
  },

  async signOut() {
    set({ isLoading: true });
    await supabase.auth.signOut().catch(() => null);
    set({ session: null, servant: null, isLoading: false, error: null });
  },
}));

/** Read-only convenience for layouts that need a single boolean. */
export const useIsHydrated = () => useAuthStore((s) => s.isHydrated);

let bootstrapped = false;
let authSubscription: { unsubscribe: () => void } | null = null;

/**
 * Wires the store to Supabase. Idempotent — safe to call from the root
 * layout effect. Returns the unsubscribe so tests/HMR can tear it down.
 */
export function bootstrapAuth(): () => void {
  if (bootstrapped) return () => {};
  bootstrapped = true;

  void useAuthStore.getState().refresh();

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      useAuthStore.setState({ session: null, servant: null, isLoading: false });
      return;
    }
    // Don't toggle isLoading here — the action that triggered the auth
    // change (e.g. verifyEmailOtp) already manages it, and layouts are
    // gated on isHydrated, not isLoading. We just refresh the joined
    // servant row whenever the underlying session changes.
    useAuthStore.setState({ session });
    fetchMyServant()
      .then(async (servant) => {
        if (!servant) {
          await supabase.auth.signOut();
          useAuthStore.setState({
            session: null,
            servant: null,
            error: ORPHAN_ERROR,
          });
          return;
        }
        useAuthStore.setState({ session, servant, error: null });
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Failed to load servant profile';
        useAuthStore.setState({ error: message });
      });
  });
  authSubscription = data.subscription;

  return () => {
    authSubscription?.unsubscribe();
    authSubscription = null;
    bootstrapped = false;
  };
}

/**
 * Test-only: reset module-level bootstrap state and store contents.
 */
export function __resetAuthStoreForTests() {
  authSubscription?.unsubscribe();
  authSubscription = null;
  bootstrapped = false;
  useAuthStore.setState({
    session: null,
    servant: null,
    isHydrated: false,
    isLoading: false,
    error: null,
  });
}
