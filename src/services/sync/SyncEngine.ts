/**
 * SyncEngine — the single coordinator that mediates between the local
 * SQLite cache and Supabase. Two passes:
 *
 *   pull()  reads `last_pull_at`, calls each `sync_*_since` RPC, applies
 *           rows via repositories, advances the high-watermark.
 *   push()  drains `local_sync_queue` oldest-first; on success dequeues,
 *           on failure schedules a backoff (5s/15s/60s/300s/600s),
 *           on 4xx marks `needs_attention` + emits a system notification.
 *
 * `runOnce()` is push-then-pull (the order matters for the conflict
 * detection in §6.6 of the design doc). `start()` wires the engine to
 * auth state + AppState transitions.
 *
 * The engine is module-singleton state with a small Zustand store
 * exposed via `useSyncState`. Tests inject a custom `SupabaseLike`
 * via `createSyncEngine`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import * as Network from 'expo-network';
import { create } from 'zustand';

import { supabase } from '@/services/api/supabase';
import { useAuthStore } from '@/state/authStore';
import { useNotificationsStore } from '@/state/notificationsStore';
import { notificationFromRow } from '@/services/notifications/types';
import {
  applyServerRows as applyAttendanceServerRows,
  type ServerAttendanceRow,
  rewriteAttendancePersonId,
} from '@/services/db/repositories/attendanceRepo';
import { upsertEvents } from '@/services/db/repositories/eventsRepo';
import {
  insertLocalSystemNotification,
  upsertNotifications,
} from '@/services/db/repositories/notificationsRepo';
import { getPerson, rewritePersonId, upsertPersons } from '@/services/db/repositories/personsRepo';
import {
  backoffFor,
  clearQueue,
  dequeue,
  listAll as listQueueAll,
  length as queueLength,
  markAttempt,
  markNeedsAttention,
  nextPendingAttemptAt,
  peek,
  pendingLength,
  resetPendingBackoffs,
  rewriteTempId,
  type QueueOp,
} from '@/services/db/repositories/queueRepo';
import { getMeta, setMeta } from '@/services/db/repositories/syncMetaRepo';
import type { CalendarEvent } from '@/types/event';
import type { Person } from '@/types/person';

export type SyncStatus = 'idle' | 'pulling' | 'pushing' | 'error' | 'offline';

export interface SyncStateSnapshot {
  status: SyncStatus;
  queueLength: number;
  lastPullAt: string | null;
  lastError: string | null;
  /** True until the very first pull settles. Drives first-launch UX. */
  hasCompletedFirstPull: boolean;
  /** Set when an op had its server-update silently overwritten. */
  conflictedPersonName: string | null;
}

interface SyncStateActions {
  setStatus: (status: SyncStatus) => void;
  setQueueLength: (n: number) => void;
  setLastPullAt: (iso: string | null) => void;
  setLastError: (err: string | null) => void;
  setHasCompletedFirstPull: (v: boolean) => void;
  setConflictedPersonName: (name: string | null) => void;
}

export const useSyncState = create<SyncStateSnapshot & SyncStateActions>((set) => ({
  status: 'idle',
  queueLength: 0,
  lastPullAt: null,
  lastError: null,
  hasCompletedFirstPull: false,
  conflictedPersonName: null,
  setStatus: (status) => set({ status }),
  setQueueLength: (queueLength) => set({ queueLength }),
  setLastPullAt: (lastPullAt) => set({ lastPullAt }),
  setLastError: (lastError) => set({ lastError }),
  setHasCompletedFirstPull: (hasCompletedFirstPull) => set({ hasCompletedFirstPull }),
  setConflictedPersonName: (conflictedPersonName) => set({ conflictedPersonName }),
}));

/** Minimal supabase surface the engine touches. Extracted for testing. */
export interface SupabaseLike {
  rpc: SupabaseClient['rpc'];
}

interface SyncDeps {
  client: SupabaseLike;
}

interface ServerErrorMeta {
  code?: string | null;
  status?: number | null;
}

function isClient4xx(meta: ServerErrorMeta): boolean {
  if (typeof meta.status === 'number') return meta.status >= 400 && meta.status < 500;
  // PostgREST errors often surface as a `code` rather than an HTTP
  // status. The meaningful 4xx classes for our RPCs:
  //   * `P0001` — RAISE EXCEPTION from PL/pgSQL (e.g. edit_window_closed).
  //   * `42501` — insufficient_privilege (RLS).
  //   * `23xxx` — integrity violations.
  if (meta.code === 'P0001' || meta.code === '42501' || meta.code?.startsWith('23')) return true;
  return false;
}

function pgMeta(error: unknown): ServerErrorMeta {
  if (!error || typeof error !== 'object') return {};
  const e = error as { code?: string; status?: number; statusCode?: number };
  return { code: e.code ?? null, status: e.status ?? e.statusCode ?? null };
}

interface ServerAttendanceRowRaw {
  kind: 'upsert' | 'delete';
  event_id: string;
  person_id: string;
  marked_by: string | null;
  marked_at: string | null;
  deleted_at: string | null;
}

export class SyncEngine {
  /** Set while a runOnce is in-flight to prevent reentrancy. */
  private running = false;
  /** True when a kick fired during a run; the engine re-runs after. */
  private rerunPending = false;
  /** Debounces rapid `kick()` calls into a single runOnce. */
  private kickTimer: ReturnType<typeof setTimeout> | null = null;
  /** Schedules the next push attempt while a queue op is in backoff. */
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  /** Smallest interval (ms) the retry timer ever sleeps for. */
  private static readonly MIN_RETRY_MS = 500;
  /** Cap on the retry sleep so a long backoff doesn't strand the queue. */
  private static readonly MAX_RETRY_MS = 60_000;
  /**
   * When the OS reports the device is offline, the queue can't drain
   * regardless of the per-op backoff schedule. Cap the retry interval
   * to this value so the engine notices reconnect within seconds even
   * if `addNetworkStateListener` misses the OS event (which Android
   * does on some Wi-Fi → cellular hand-offs).
   */
  private static readonly OFFLINE_PROBE_MS = 2_000;

  constructor(private readonly deps: SyncDeps = { client: supabase }) {}

  async pull(): Promise<void> {
    useSyncState.getState().setStatus('pulling');
    useSyncState.getState().setLastError(null);
    try {
      const since = await getMeta('last_pull_at');
      const sinceArg = since ?? null;

      const [personsRes, eventsRes, attendanceRes, notificationsRes] = await Promise.all([
        this.deps.client.rpc('sync_persons_since', { since: sinceArg }),
        this.deps.client.rpc('sync_events_since', { since: sinceArg }),
        this.deps.client.rpc('sync_attendance_since', { since: sinceArg }),
        this.deps.client.rpc('sync_notifications_since', { since: sinceArg }),
      ]);

      if (personsRes.error) throw personsRes.error;
      if (eventsRes.error) throw eventsRes.error;
      if (attendanceRes.error) throw attendanceRes.error;
      if (notificationsRes.error) throw notificationsRes.error;

      const persons = (personsRes.data ?? []) as Person[];
      const events = (eventsRes.data ?? []) as CalendarEvent[];
      const attendance = ((attendanceRes.data ?? []) as ServerAttendanceRowRaw[]).map(
        (r): ServerAttendanceRow =>
          r.kind === 'upsert'
            ? {
                kind: 'upsert',
                event_id: r.event_id,
                person_id: r.person_id,
                marked_by: r.marked_by ?? '',
                marked_at: r.marked_at ?? new Date(0).toISOString(),
              }
            : { kind: 'delete', event_id: r.event_id, person_id: r.person_id },
      );
      const notifications = (notificationsRes.data ?? []) as Parameters<
        typeof upsertNotifications
      >[0];

      // Conflict detection: any incoming person whose updated_at is
      // newer than the locally cached row AND who has a queued
      // mutation against it. Surface the most-recent conflicted row's
      // name to the indicator after the push completes; the next pull
      // (and this very upsert) overwrites the local row with the
      // server's version, satisfying server-wins semantics.
      const conflicted = await detectPersonConflicts(persons);

      // soft-deleted persons → keep the deleted_at marker; the local
      // SELECTs filter out `deleted_at IS NOT NULL`. Upsert handles it.
      await upsertPersons(persons, 'synced');
      await upsertEvents(events);
      await applyAttendanceServerRows(attendance);
      await upsertNotifications(notifications);

      if (conflicted) {
        useSyncState.getState().setConflictedPersonName(conflicted);
      }

      const newWatermark = new Date().toISOString();
      await setMeta('last_pull_at', newWatermark);
      useSyncState.getState().setLastPullAt(newWatermark);
      useSyncState.getState().setHasCompletedFirstPull(true);
      useSyncState.getState().setStatus('idle');
    } catch (err) {
      useSyncState.getState().setLastError(toMessage(err));
      useSyncState.getState().setStatus('offline');
      throw err;
    }
  }

  async push(): Promise<void> {
    useSyncState.getState().setStatus('pushing');
    useSyncState.getState().setLastError(null);
    let drained = 0;
    try {
      // Pre-check: if the OS reports we're offline, don't even try
      // any RPC. Letting `dispatchOp` fail on every op would inflate
      // the backoff counter for failures that aren't the server's
      // fault — by the time the user reconnects we'd be sitting on
      // a 5–10 minute backoff. The retry timer polls every 2s while
      // offline (see `scheduleRetryFromQueue`).
      if (await this.isOffline()) {
        return;
      }
      // Drain in a tight loop. `peek` already excludes ops still in
      // backoff (`next_attempt_at > now`).
      for (let safety = 0; safety < 1_000; safety++) {
        const op = await peek();
        if (!op) break;
        const result = await this.dispatchOp(op);
        if (result === 'success') {
          await dequeue(op.id);
          drained++;
        } else if (result === 'transient') {
          // Backoff scheduled by markAttempt; stop draining and let the
          // next tick (or runOnce after a `start()` wake) retry.
          break;
        } else {
          // 4xx → marked needs_attention; skip but continue (other ops
          // may still succeed).
          continue;
        }
      }
    } finally {
      const len = await queueLength();
      useSyncState.getState().setQueueLength(len);
      useSyncState.getState().setStatus(len === 0 ? 'idle' : 'offline');
    }
    void drained;
  }

  private async isOffline(): Promise<boolean> {
    try {
      const state = await Network.getNetworkStateAsync();
      const reachable = state.isInternetReachable ?? state.isConnected ?? true;
      return !reachable;
    } catch {
      // expo-network unavailable in this env (jest, web fallback). Treat
      // as online so the engine's existing transient-error path still
      // exercises the backoff schedule.
      return false;
    }
  }

  /**
   * One serial push-then-pull cycle. By default both passes run. Pass
   * `pull: false` for the internal retry timer where a fresh pull every
   * few seconds would be wasteful — the next user-initiated trigger
   * (foreground / pull-to-refresh / next enqueue) re-pulls anyway.
   */
  async runOnce(opts: { pull?: boolean } = {}): Promise<void> {
    const doPull = opts.pull ?? true;
    if (this.running) {
      this.rerunPending = true;
      return;
    }
    this.running = true;
    try {
      this.clearRetry();
      await this.push().catch(() => null);
      if (doPull) await this.pull().catch(() => null);
      const len = await queueLength();
      useSyncState.getState().setQueueLength(len);
      // Always mark first-pull as completed after the first attempt so
      // the UI doesn't block forever when the device is offline at
      // install time. The cache will simply be empty until the next
      // successful pull.
      useSyncState.getState().setHasCompletedFirstPull(true);
      // If pending ops remain (network is down, or a transient failure
      // pushed the head's `next_attempt_at` into the future), schedule
      // a retry. This is what makes the queue self-drain when the
      // device comes back online without requiring the user to pull.
      const pending = await pendingLength();
      if (pending > 0) await this.scheduleRetryFromQueue();
    } finally {
      this.running = false;
      if (this.rerunPending) {
        this.rerunPending = false;
        void this.runOnce();
      }
    }
  }

  /**
   * Fire-and-forget trigger called by service-layer enqueues. Multiple
   * kicks within ~50ms collapse into a single runOnce — useful when a
   * UI "Save" enqueues several ops in one frame.
   */
  kick(): void {
    if (this.kickTimer) return;
    this.kickTimer = setTimeout(() => {
      this.kickTimer = null;
      void this.runOnce();
    }, 50);
  }

  /** Wires AppState + auth + network signals to runOnce. Returns a teardown. */
  start(opts: {
    onAppForeground: (cb: () => void) => () => void;
    onSignedIn: (cb: () => void) => () => void;
    /**
     * Optional. Fires when the device transitions from offline to
     * online. The engine resets pending ops' `next_attempt_at` so the
     * queue drains immediately instead of waiting for the current
     * backoff window to expire.
     */
    onNetworkConnected?: (cb: () => void) => () => void;
  }): () => void {
    const fire = () => {
      void this.runOnce();
    };
    const offFg = opts.onAppForeground(fire);
    const offAuth = opts.onSignedIn(fire);
    const offNet = opts.onNetworkConnected
      ? opts.onNetworkConnected(() => {
          // Online again: drop the backoff so the next runOnce drains
          // the queue right away. Without this, a 60s+ backoff would
          // strand a queued op even though the network is back.
          void resetPendingBackoffs().then(() => fire());
        })
      : () => {};
    fire();
    return () => {
      offFg();
      offAuth();
      offNet();
      this.clearRetry();
      if (this.kickTimer) {
        clearTimeout(this.kickTimer);
        this.kickTimer = null;
      }
    };
  }

  /**
   * Schedule the next push attempt at the soonest pending op's
   * `next_attempt_at`. If no pending op exists, no timer is set.
   * The retry runs push only — it does NOT re-pull, since that would
   * burn network on every backoff tick.
   *
   * If the OS reports the device is offline, the retry is capped at
   * OFFLINE_PROBE_MS regardless of the per-op backoff. This is the
   * reliable fallback when `addNetworkStateListener` misses the
   * reconnect event: the engine polls every 2s and retries the moment
   * the OS says we're back online.
   */
  private async scheduleRetryFromQueue(): Promise<void> {
    if (this.retryTimer) return;
    const offline = await this.isOffline();
    let delay: number;
    if (offline) {
      // Polling mode: probe every OFFLINE_PROBE_MS (~2s) until the OS
      // reports we're back online. The per-op backoff is irrelevant
      // while offline because no RPC has actually run.
      delay = SyncEngine.OFFLINE_PROBE_MS;
    } else {
      // Online: respect the soonest pending op's `next_attempt_at`
      // — that's the server-side backoff schedule (5/15/60/300/600s).
      const at = await nextPendingAttemptAt();
      if (at === null) return;
      delay = Math.min(SyncEngine.MAX_RETRY_MS, Math.max(SyncEngine.MIN_RETRY_MS, at - Date.now()));
    }
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.runOnce({ pull: false });
    }, delay);
  }

  private clearRetry(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  /**
   * Dispatch a single op. Returns:
   *   'success'   — op succeeded; caller should dequeue.
   *   'transient' — network/5xx; backoff scheduled.
   *   'fatal'     — 4xx; needs_attention set + system notification emitted.
   */
  private async dispatchOp(op: QueueOp): Promise<'success' | 'transient' | 'fatal'> {
    try {
      switch (op.op_type) {
        case 'mark_attendance':
          await this.callRpc('mark_attendance', {
            p_event_id: op.payload.event_id,
            p_person_ids: op.payload.person_ids,
          });
          return 'success';
        case 'unmark_attendance':
          await this.callRpc('unmark_attendance', {
            p_event_id: op.payload.event_id,
            p_person_ids: op.payload.person_ids,
          });
          return 'success';
        case 'create_person': {
          const data = await this.callRpc('create_person', {
            payload: op.payload.payload,
          });
          const realId = data as string;
          if (op.temp_id && realId) {
            await rewritePersonId(op.temp_id, realId);
            await rewriteAttendancePersonId(op.temp_id, realId);
            await rewriteTempId(op.temp_id, realId);
          }
          return 'success';
        }
        case 'update_person':
          await this.callRpc('update_person', {
            person_id: op.payload.person_id,
            payload: op.payload.payload,
          });
          return 'success';
        case 'soft_delete_person':
          await this.callRpc('soft_delete_person', {
            person_id: op.payload.person_id,
          });
          return 'success';
        case 'assign_person':
          await this.callRpc('assign_person', {
            person_id: op.payload.person_id,
            servant_id: op.payload.servant_id,
            reason: op.payload.reason,
          });
          return 'success';
        case 'mark_notification_read':
          await this.callRpc('mark_notification_read', {
            notification_id: op.payload.notification_id,
          });
          return 'success';
        default: {
          // Unknown op — treat as fatal so the queue doesn't infinitely
          // retry. Surface it like a 4xx.
          await this.handle4xx(op, `unknown_op:${op.op_type as string}`);
          return 'fatal';
        }
      }
    } catch (err) {
      const meta = pgMeta(err);
      if (isClient4xx(meta)) {
        await this.handle4xx(op, toMessage(err));
        return 'fatal';
      }
      // Transient: queueRepo.markAttempt schedules `next_attempt_at`
      // per the backoff schedule; the retry timer kicks runOnce again
      // when the head op becomes drainable.
      void backoffFor;
      await markAttempt(op.id, toMessage(err));
      useSyncState.getState().setLastError(toMessage(err));
      return 'transient';
    }
  }

  private async callRpc(name: string, args: Record<string, unknown>): Promise<unknown> {
    const { data, error } = await this.deps.client.rpc(name, args);
    if (error) throw error;
    return data;
  }

  private async handle4xx(op: QueueOp, reason: string): Promise<void> {
    await markNeedsAttention(op.id, reason);
    // Emit a local system notification so the user sees it in the inbox
    // even before the next pull. The recipient is the currently
    // authenticated servant; if we somehow don't have one, drop the
    // notification (the queue still records `needs_attention`).
    const recipient = useAuthStore.getState().servant?.id;
    if (!recipient) return;
    const localId = `local-sync-error-${op.id}`;
    const message = friendly4xxMessage(op, reason);
    try {
      await insertLocalSystemNotification({
        id: localId,
        recipientServantId: recipient,
        message,
      });
      // Surface in the in-memory store too (so the banner appears).
      useNotificationsStore.getState().add(
        notificationFromRow({
          id: localId,
          recipient_servant_id: recipient,
          type: 'system',
          payload: { message },
          read_at: null,
          created_at: new Date().toISOString(),
        }),
      );
    } catch {
      /* failure to surface a notification mustn't crash the engine */
    }
  }

  /** Test helper: clear queue + first-pull flag without exposing internals. */
  async __resetForTests(): Promise<void> {
    await clearQueue();
    useSyncState.setState({
      status: 'idle',
      queueLength: 0,
      lastPullAt: null,
      lastError: null,
      hasCompletedFirstPull: false,
      conflictedPersonName: null,
    });
    this.running = false;
    this.rerunPending = false;
    if (this.kickTimer) {
      clearTimeout(this.kickTimer);
      this.kickTimer = null;
    }
    this.clearRetry();
  }
}

/**
 * Returns the display name of the most recent locally-modified person
 * whose server `updated_at` is newer than the local one. The check is
 * conservative: if no queued op references the row, we don't flag it
 * (the local row was synced and then changed remotely without
 * collision). The returned name is rendered in the conflict Snackbar.
 */
async function detectPersonConflicts(incoming: readonly Person[]): Promise<string | null> {
  if (incoming.length === 0) return null;
  const queued = await listQueueAll();
  const queuedPersonIds = new Set<string>();
  for (const op of queued) {
    if (op.op_type === 'update_person' || op.op_type === 'soft_delete_person') {
      const id = op.payload.person_id;
      if (typeof id === 'string') queuedPersonIds.add(id);
    }
  }
  if (queuedPersonIds.size === 0) return null;

  let conflicted: { name: string; at: number } | null = null;
  for (const remote of incoming) {
    if (!queuedPersonIds.has(remote.id)) continue;
    const local = await getPerson(remote.id);
    if (!local) continue;
    const remoteAt = Date.parse(remote.updated_at);
    const localAt = Date.parse(local.updated_at);
    if (remoteAt > localAt) {
      const name = `${remote.first_name} ${remote.last_name}`.trim();
      if (!conflicted || remoteAt > conflicted.at) {
        conflicted = { name, at: remoteAt };
      }
    }
  }
  return conflicted?.name ?? null;
}

function friendly4xxMessage(op: QueueOp, reason: string): string {
  const subject =
    op.op_type === 'mark_attendance' || op.op_type === 'unmark_attendance'
      ? 'check-in'
      : op.op_type === 'create_person' || op.op_type === 'update_person'
        ? 'person edit'
        : 'change';
  return `Your ${subject} could not be saved: ${reason}`;
}

function toMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const e = err as { message?: string; error?: string };
    return e.message ?? e.error ?? 'unknown error';
  }
  return 'unknown error';
}

let singleton: SyncEngine | null = null;

export function getSyncEngine(): SyncEngine {
  if (!singleton) singleton = new SyncEngine();
  return singleton;
}

export function __setSyncEngineForTests(engine: SyncEngine | null): void {
  singleton = engine;
}

/**
 * Test-only: if the module-level singleton has been instantiated,
 * clear its pending kick / retry timers and reset the sync state
 * store. Safe to call when no singleton exists (no-op). Used by the
 * global jest afterEach to keep timer leaks from spilling between
 * test files.
 */
export async function __resetSyncEngineSingletonForTests(): Promise<void> {
  if (!singleton) return;
  await singleton.__resetForTests().catch(() => undefined);
}

export function createSyncEngine(deps?: SyncDeps): SyncEngine {
  return new SyncEngine(deps);
}
