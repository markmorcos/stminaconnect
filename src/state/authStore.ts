import type { AuthError, Session } from '@supabase/supabase-js';
import i18next from 'i18next';
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
   * True while an action (signInWithMagicLink / signOut / …) is in
   * flight. Screens use this to disable buttons; layouts MUST NOT
   * gate on it (toggling it during a sign-in would otherwise unmount
   * the screen and lose its local form state).
   */
  isLoading: boolean;
  error: string | null;
  /**
   * Set to a fresh Supabase `action_link` URL when the typed email
   * matches the server-configured Play / App Store reviewer email.
   * The sign-in screen renders a dialog with this URL and a "Sign in"
   * button that opens it via `Linking.openURL`. Null for every other
   * sign-in attempt — real users go through the standard "check your
   * email" flow with no dialog and no behavioural change.
   */
  reviewLink: string | null;
  signInWithMagicLink: (email: string, redirectTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  clearReviewLink: () => void;
  /**
   * Replaces the in-memory servant row with the given partial. Used by
   * the account screen to reflect a successful display-name save without
   * a round-trip back to `fetchMyServant`.
   */
  setServant: (partial: Partial<ServantRow>) => void;
}

// eslint-disable-next-line import/no-named-as-default-member -- i18next exposes its API on the default export
const orphanError = (): string => i18next.t('auth.errors.orphan');
// eslint-disable-next-line import/no-named-as-default-member
const signInFailedError = (): string => i18next.t('auth.errors.signInFailed');
// eslint-disable-next-line import/no-named-as-default-member
const loadProfileError = (): string => i18next.t('auth.errors.loadServantFailed');

/**
 * Translates a Supabase AuthError into a user-facing string. We map
 * the handful of codes a user actually hits during magic-link send
 * and fall through to a generic message for the rest — better than
 * showing GoTrue's English `error.message` when the UI is in
 * Arabic / German.
 */
function mapAuthError(error: AuthError | null | undefined, fallback: () => string): string {
  if (!error) return fallback();
  // Network / fetch failures from gotrue-js — no HTTP status reached us.
  if (
    error.name === 'AuthRetryableFetchError' ||
    error.status === undefined ||
    error.status === 0
  ) {
    // eslint-disable-next-line import/no-named-as-default-member
    return i18next.t('auth.errors.network');
  }
  switch (error.code) {
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      // eslint-disable-next-line import/no-named-as-default-member
      return i18next.t('auth.errors.rateLimit');
    default:
      // eslint-disable-next-line import/no-named-as-default-member
      return i18next.t('auth.errors.unknown');
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  servant: null,
  isHydrated: false,
  isLoading: false,
  error: null,
  reviewLink: null,

  async refresh() {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      set({
        session: null,
        servant: null,
        isHydrated: true,
        error: mapAuthError(error, signInFailedError),
      });
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
        set({ session: null, servant: null, isHydrated: true, error: orphanError() });
        return;
      }
      set({ session, servant, isHydrated: true, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : loadProfileError();
      set({ session, servant: null, isHydrated: true, error: message });
    }
  },

  async signInWithMagicLink(email, redirectTo) {
    set({ isLoading: true, error: null, reviewLink: null });

    // Reviewer-bypass probe: every sign-in attempt is offered to the
    // `review-login` Edge Function first, which compares the supplied
    // email to a server-only `REVIEW_BYPASS_EMAIL` secret. For real
    // users it returns `{ link: null }` and we fall through to the
    // standard magic-link send below — no behavioural change. For the
    // single configured Play / App Store reviewer email it returns a
    // freshly-minted `action_link` URL that the sign-in screen surfaces
    // via a dialog. See `openspec/changes/add-play-review-login-bypass/`.
    //
    // The function is wrapped in try/catch and falls through to
    // `signInWithOtp` on ANY failure (network error, function down,
    // 5xx, malformed body) so an Edge Function outage degrades to
    // today's behaviour rather than locking real users out.
    try {
      const { data } = await supabase.functions.invoke<{ link: string | null }>('review-login', {
        body: { email, redirectTo },
      });
      if (data?.link) {
        set({ isLoading: false, error: null, reviewLink: data.link });
        return;
      }
    } catch (e) {
      if (__DEV__) {
        console.warn('review-login probe failed; falling through to signInWithOtp', e);
      }
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: false,
      },
    });
    if (error) {
      set({ isLoading: false, error: mapAuthError(error, signInFailedError) });
      return;
    }
    set({ isLoading: false, error: null });
  },

  clearReviewLink() {
    set({ reviewLink: null });
  },

  async signOut() {
    set({ isLoading: true });
    await supabase.auth.signOut().catch(() => null);
    set({ session: null, servant: null, isLoading: false, error: null });
  },

  setServant(partial) {
    const current = get().servant;
    if (!current) return;
    set({ servant: { ...current, ...partial } });
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
    // change (e.g. exchangeCodeForSession on the callback screen)
    // already manages it, and layouts are gated on isHydrated, not
    // isLoading. We just refresh the joined servant row whenever the
    // underlying session changes.
    useAuthStore.setState({ session });
    fetchMyServant()
      .then(async (servant) => {
        if (!servant) {
          await supabase.auth.signOut();
          useAuthStore.setState({
            session: null,
            servant: null,
            error: orphanError(),
          });
          return;
        }
        useAuthStore.setState({ session, servant, error: null });
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : loadProfileError();
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
    reviewLink: null,
  });
}
