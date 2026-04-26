/**
 * Wires the SyncEngine to the app lifecycle:
 *
 *   * fires `runOnce()` on every signed-in mount.
 *   * fires `runOnce()` on AppState foreground transitions.
 *   * fires `runOnce()` on `auth` state transitions to a fresh session
 *     (so first sign-in primes the cache).
 *
 * Single hook, called once from `app/(app)/_layout.tsx`. Returns the
 * teardown for tests / HMR.
 */
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Network from 'expo-network';

import { getSyncEngine } from '@/services/sync/SyncEngine';
import { useAuthStore } from '@/state/authStore';

export function useSyncBootstrap(): void {
  useEffect(() => {
    const engine = getSyncEngine();
    const teardown = engine.start({
      onAppForeground: (cb) => {
        let prev: AppStateStatus = AppState.currentState;
        const sub = AppState.addEventListener('change', (next) => {
          if (prev !== 'active' && next === 'active') cb();
          prev = next;
        });
        return () => sub.remove();
      },
      onSignedIn: (cb) => {
        // Subscribe to authStore. Fire on every `session` flip from null
        // to non-null.
        let lastUserId: string | null = useAuthStore.getState().session?.user.id ?? null;
        const unsub = useAuthStore.subscribe((s) => {
          const next = s.session?.user.id ?? null;
          if (next && next !== lastUserId) {
            lastUserId = next;
            cb();
          } else {
            lastUserId = next;
          }
        });
        return () => unsub();
      },
      onNetworkConnected: (cb) => {
        // Fire `cb` on every offline → online transition. The first
        // event from `addNetworkStateListener` is the *current* state,
        // so we seed `lastConnected` from it instead of treating it as
        // a transition. `isInternetReachable` is preferred over
        // `isConnected` because a Wi-Fi network without a default
        // route still reports connected on Android.
        let lastConnected: boolean | null = null;
        const sub = Network.addNetworkStateListener((state) => {
          const reachable = state.isInternetReachable ?? state.isConnected ?? false;
          if (lastConnected === false && reachable === true) cb();
          lastConnected = reachable;
        });
        return () => sub.remove();
      },
    });
    return teardown;
  }, []);
}
