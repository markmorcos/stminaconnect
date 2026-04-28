/**
 * RealNotificationService — phase-17 dispatcher.
 *
 * Inherits the inbox/Realtime behavior from `MockNotificationService`
 * (the "mock" name is historical; that class already does the real
 * server round-trip for the in-app side). On top of that we layer:
 *
 *   1. **Token lifecycle**: on first refresh after sign-in we ask for OS
 *      notification permission, fetch the Expo push token, and persist
 *      via the `register_push_token` RPC. On every AppState foreground
 *      transition we re-fetch and upsert if the token rotated. On
 *      teardown (sign-out) we deactivate the token via
 *      `deactivate_push_token`.
 *   2. **Tap-to-open**: an `addNotificationResponseReceivedListener`
 *      subscription routes incoming taps through `notificationRouter`
 *      and `router.push(...)`. Mounted once for the service's lifetime.
 *
 * The `expo-notifications` and `expo-constants` modules are injected
 * via the constructor so jest tests can drive the service without a
 * real native runtime.
 */
import {
  AppState,
  type AppStateStatus,
  type NativeEventSubscription,
  Platform,
} from 'react-native';
import { router } from 'expo-router';

import { supabase } from '@/services/api/supabase';

import { MockNotificationService } from './MockNotificationService';
import { notificationRouter } from './notificationRouter';
import type {
  DispatchArgs,
  NotificationListener,
  NotificationService,
} from './NotificationService';
import type { NotificationType } from './types';

// ---------------------------------------------------------------------------
// Injectable surface — narrow shapes covering only what we use, so tests
// don't need to mock the entire `expo-notifications` module.
// ---------------------------------------------------------------------------

export interface PermissionStatusLike {
  status: 'granted' | 'denied' | 'undetermined' | string;
  granted: boolean;
  canAskAgain?: boolean;
}

export interface ExpoPushTokenLike {
  data: string;
}

export interface NotificationResponseLike {
  notification: {
    request: {
      content: {
        data?: { type?: unknown; payload?: Record<string, unknown> } | null;
      };
    };
  };
}

export interface NotificationsApi {
  requestPermissionsAsync(): Promise<PermissionStatusLike>;
  getPermissionsAsync?(): Promise<PermissionStatusLike>;
  getExpoPushTokenAsync(opts: { projectId?: string }): Promise<ExpoPushTokenLike>;
  addNotificationResponseReceivedListener(listener: (response: NotificationResponseLike) => void): {
    remove(): void;
  };
}

export interface ConstantsApi {
  expoConfig?: {
    extra?: { eas?: { projectId?: string } };
    name?: string;
    version?: string;
  } | null;
  deviceName?: string | null;
}

export interface RealServiceOptions {
  /** Returns the current servant id (or null when signed out). */
  getServantId: () => string | null;
  /** Injected `expo-notifications` surface. */
  notifications: NotificationsApi;
  /** Injected `expo-constants` surface. */
  constants: ConstantsApi;
  /** Override AppState (tests). */
  appState?: typeof AppState;
  /** Override the deep-link push (tests). */
  pushRoute?: (route: string) => void;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class RealNotificationService implements NotificationService {
  private readonly mock: MockNotificationService;
  private readonly responseSub: { remove(): void } | null;
  private appStateSub: NativeEventSubscription | null;
  private readonly appState: typeof AppState;
  private readonly pushRoute: (route: string) => void;
  /** Last token we know is registered. Suppresses duplicate writes. */
  private currentToken: string | null = null;
  /** Set true once `register_push_token` has completed for this session. */
  private bootstrapped = false;

  constructor(private readonly options: RealServiceOptions) {
    this.mock = new MockNotificationService({ getServantId: options.getServantId });
    this.appState = options.appState ?? AppState;
    this.pushRoute = options.pushRoute ?? ((r) => router.push(r as never));
    this.responseSub = options.notifications.addNotificationResponseReceivedListener((response) =>
      this.handleResponse(response),
    );
    let prev: AppStateStatus = this.appState.currentState;
    this.appStateSub = this.appState.addEventListener('change', (next) => {
      if (prev !== 'active' && next === 'active') {
        // Foreground transition: refresh the token in case it rotated.
        void this.refreshPushToken();
      }
      prev = next;
    });
  }

  // -------------------------------------------------------------------------
  // NotificationService — inbox / realtime delegation
  // -------------------------------------------------------------------------

  dispatch<T extends NotificationType>(args: DispatchArgs<T>): Promise<string> {
    return this.mock.dispatch(args);
  }

  subscribe(listener: NotificationListener): () => void {
    return this.mock.subscribe(listener);
  }

  markRead(notificationId: string): Promise<void> {
    return this.mock.markRead(notificationId);
  }

  markAllRead(): Promise<void> {
    return this.mock.markAllRead();
  }

  /**
   * Inbox refresh + token registration. The provider calls this whenever
   * a servant id appears (sign-in, deep-link return). Token registration
   * is best-effort: a failure here MUST NOT block the inbox load, since
   * the in-app banner stream is independent of OS push.
   */
  async refresh(): Promise<void> {
    await this.mock.refresh();
    if (!this.bootstrapped && this.options.getServantId()) {
      this.bootstrapped = true;
      try {
        await this.registerPushToken();
      } catch (e) {
        console.warn('[push] register failed', e);
      }
    }
  }

  /**
   * Sign-out path. Deactivate the active token before tearing down the
   * Realtime channel so a server-side dispatch during the small window
   * between teardown and process exit doesn't try to push to a token we
   * already gave up on.
   */
  async teardown(): Promise<void> {
    if (this.currentToken) {
      try {
        await supabase.rpc('deactivate_push_token', { token: this.currentToken });
      } catch {
        // Best-effort: a network blip on sign-out shouldn't strand the user.
      }
    }
    this.currentToken = null;
    this.bootstrapped = false;
    if (this.appStateSub) {
      this.appStateSub.remove();
      this.appStateSub = null;
    }
    if (this.responseSub) {
      this.responseSub.remove();
    }
    await this.mock.teardown();
  }

  // -------------------------------------------------------------------------
  // Push token lifecycle
  // -------------------------------------------------------------------------

  private async registerPushToken(): Promise<void> {
    let perm: PermissionStatusLike | null = null;
    if (this.options.notifications.getPermissionsAsync) {
      perm = await this.options.notifications.getPermissionsAsync();
    }
    if (!perm || !perm.granted) {
      perm = await this.options.notifications.requestPermissionsAsync();
    }
    if (!perm.granted) return;

    const projectId = this.options.constants.expoConfig?.extra?.eas?.projectId;
    const tokenResp = await this.options.notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResp.data;
    if (!token) return;

    await supabase.rpc('register_push_token', {
      token,
      device_info: this.deviceInfo(),
    });
    this.currentToken = token;
  }

  private async refreshPushToken(): Promise<void> {
    if (!this.options.getServantId()) return;
    let perm: PermissionStatusLike | null = null;
    if (this.options.notifications.getPermissionsAsync) {
      perm = await this.options.notifications.getPermissionsAsync();
    }
    if (!perm || !perm.granted) return;
    const projectId = this.options.constants.expoConfig?.extra?.eas?.projectId;
    const tokenResp = await this.options.notifications.getExpoPushTokenAsync({ projectId });
    const fresh = tokenResp.data;
    if (!fresh) return;
    if (fresh === this.currentToken) {
      // Same token; do nothing (RPC would still bump last_seen_at, but
      // we'd rather minimize per-foreground writes).
      return;
    }
    if (this.currentToken) {
      try {
        await supabase.rpc('deactivate_push_token', { token: this.currentToken });
      } catch {
        // proceed regardless — register_push_token below is the
        // authoritative state change for the new token.
      }
    }
    await supabase.rpc('register_push_token', {
      token: fresh,
      device_info: this.deviceInfo(),
    });
    this.currentToken = fresh;
  }

  private deviceInfo(): Record<string, unknown> {
    const cfg = this.options.constants.expoConfig;
    return {
      platform: Platform.OS,
      appName: cfg?.name ?? null,
      appVersion: cfg?.version ?? null,
      deviceName: this.options.constants.deviceName ?? null,
    };
  }

  // -------------------------------------------------------------------------
  // Tap-to-open routing
  // -------------------------------------------------------------------------

  private handleResponse(response: NotificationResponseLike): void {
    const data = response.notification.request.content.data ?? {};
    const type = typeof data.type === 'string' ? (data.type as NotificationType) : null;
    if (!type) return;
    const payload = (data.payload ?? {}) as Record<string, unknown>;
    const route = notificationRouter(type, payload);
    if (route) {
      this.pushRoute(route);
    }
  }
}
