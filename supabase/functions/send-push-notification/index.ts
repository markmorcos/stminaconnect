/**
 * send-push-notification — fired by the post-INSERT trigger on
 * `public.notifications`. Reads the row by id, looks up the recipient
 * + their active Expo tokens, applies quiet hours, localizes the
 * payload, POSTs to Expo Push, and deactivates any tokens that come
 * back as `DeviceNotRegistered`.
 *
 * The in-app `notifications` row is ALWAYS already in place by the
 * time we run — Realtime + the inbox keep working even if Expo Push
 * is misconfigured. We therefore log + return 200 on most "soft"
 * failure modes (no tokens, recipient missing) so pg_net doesn't
 * retry endlessly. Hard 5xx is reserved for actual coding bugs.
 */

// @ts-ignore — Supabase Edge Runtime resolves esm.sh at deploy.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

import { isWithinQuietHours, type QuietHoursSettings } from './quietHours.ts';
import { formatPushTitleBody, type NotificationKind } from './translate.ts';
import {
  createExpoPushClient,
  isDeviceNotRegistered,
  type ExpoPushClient,
  type ExpoPushMessage,
} from './expoPush.ts';

// @ts-ignore — Deno globals provided by the Edge Runtime.
declare const Deno: { env: { get(name: string): string | undefined } };

interface NotificationRow {
  id: string;
  recipient_servant_id: string;
  type: NotificationKind;
  payload: Record<string, unknown>;
}

interface ServantPrefs {
  language: string;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

interface TokenRow {
  id: string;
  token: string;
}

export interface DispatchOutcome {
  outcome: 'sent' | 'quiet_hours' | 'no_tokens' | 'no_recipient' | 'not_found' | 'error';
  attempted?: number;
  errors?: number;
  deactivated?: number;
  error?: string;
}

interface Deps {
  /** Service-role Supabase client. */
  db: ReturnType<typeof createClient>;
  /** Client over the Expo Push API. */
  expo: ExpoPushClient;
  /** Override "now" in tests. */
  now?: () => Date;
}

/**
 * Pure dispatch flow — exported so the integration tests can drive it
 * without going through `Deno.serve`.
 */
export async function dispatch(notificationId: string, deps: Deps): Promise<DispatchOutcome> {
  const now = deps.now ? deps.now() : new Date();

  const { data: rowData, error: rowErr } = await deps.db
    .from('notifications')
    .select('id, recipient_servant_id, type, payload')
    .eq('id', notificationId)
    .maybeSingle();
  if (rowErr) return { outcome: 'error', error: `notifications fetch: ${rowErr.message}` };
  if (!rowData) return { outcome: 'not_found' };
  const row = rowData as NotificationRow;

  const { data: prefsData, error: prefsErr } = await deps.db
    .from('servants')
    .select('language, quiet_hours_enabled, quiet_hours_start, quiet_hours_end')
    .eq('id', row.recipient_servant_id)
    .maybeSingle();
  if (prefsErr) return { outcome: 'error', error: `servants fetch: ${prefsErr.message}` };
  if (!prefsData) return { outcome: 'no_recipient' };
  const prefs = prefsData as ServantPrefs;

  const quiet: QuietHoursSettings = {
    enabled: prefs.quiet_hours_enabled,
    startTime: prefs.quiet_hours_start,
    endTime: prefs.quiet_hours_end,
  };
  if (isWithinQuietHours(now, quiet)) {
    return { outcome: 'quiet_hours' };
  }

  const { data: tokensData, error: tokErr } = await deps.db
    .from('expo_push_tokens')
    .select('id, token')
    .eq('servant_id', row.recipient_servant_id)
    .is('deactivated_at', null);
  if (tokErr) return { outcome: 'error', error: `tokens fetch: ${tokErr.message}` };
  const tokens = (tokensData ?? []) as TokenRow[];
  if (tokens.length === 0) return { outcome: 'no_tokens' };

  const { title, body } = formatPushTitleBody(row.type, row.payload, prefs.language);
  const messages: ExpoPushMessage[] = tokens.map((t) => ({
    to: t.token,
    title,
    body,
    priority: 'high',
    data: { notification_id: row.id, type: row.type, payload: row.payload },
  }));

  const results = await deps.expo.send(messages);

  // Find tokens whose tickets came back as DeviceNotRegistered and
  // flip their `deactivated_at`. Done as a single UPDATE per id so we
  // don't race the trigger fan-out for sibling notifications.
  let deactivated = 0;
  let errors = 0;
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.ticket.status === 'error') errors++;
    if (isDeviceNotRegistered(r.ticket)) {
      const tokenRow = tokens[i];
      const { error: deactErr } = await deps.db
        .from('expo_push_tokens')
        .update({ deactivated_at: new Date().toISOString() })
        .eq('id', tokenRow.id);
      if (deactErr) {
        // Log but don't bail; the rest of the batch still got delivered.
        console.error(`failed to deactivate token ${tokenRow.id}: ${deactErr.message}`);
      } else {
        deactivated++;
      }
    }
  }

  return {
    outcome: 'sent',
    attempted: messages.length,
    errors,
    deactivated,
  };
}

function readEnvOrThrow(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`missing env var: ${name}`);
  return v;
}

async function readNotificationId(req: Request): Promise<string | null> {
  try {
    const body = (await req.json()) as { notification_id?: string };
    return typeof body.notification_id === 'string' ? body.notification_id : null;
  } catch {
    return null;
  }
}

// @ts-ignore — Deno.serve provided by Edge Runtime.
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ outcome: 'error', error: 'method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' },
    });
  }

  const notificationId = await readNotificationId(req);
  if (!notificationId) {
    return new Response(JSON.stringify({ outcome: 'error', error: 'notification_id missing' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = readEnvOrThrow('SUPABASE_URL');
    const serviceRoleKey = readEnvOrThrow('SUPABASE_SERVICE_ROLE_KEY');
    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const expo = createExpoPushClient();
    const result = await dispatch(notificationId, { db, expo });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ outcome: 'error', error: (e as Error).message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
});
