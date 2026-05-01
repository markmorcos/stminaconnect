import { useShallow } from 'zustand/react/shallow';

import { useAuthStore } from '@/state/authStore';

/**
 * Public hook surface for auth state. Components import this rather
 * than touching the store directly so future store splits are invisible.
 *
 * `useShallow` is required: returning a fresh object literal from the
 * selector on every render would otherwise re-trigger subscribers and
 * loop forever in Zustand v5.
 */
export function useAuth() {
  return useAuthStore(
    useShallow((s) => ({
      session: s.session,
      servant: s.servant,
      isLoading: s.isLoading,
      error: s.error,
      signInWithMagicLink: s.signInWithMagicLink,
      signOut: s.signOut,
      setServant: s.setServant,
    })),
  );
}
