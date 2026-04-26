/**
 * sync-calendar-events — pulls the church Google Calendar into the
 * `events` table on a 30-minute cadence (via pg_cron) and on demand
 * (via the `trigger_calendar_sync` admin RPC).
 *
 * Auth: Google service account JWT exchanged for an OAuth2 token; the
 * service account must have read access to GOOGLE_CALENDAR_ID. See
 * docs/google-calendar-setup.md.
 *
 * Window: now() − 30 days .. now() + 14 days. Events outside this
 * window are not persisted; rows that fall out of the window or were
 * removed from the upstream calendar are deleted from `events`.
 *
 * Each row's `is_counted` is set to `match_counted_event(title)` at
 * sync time. Pattern changes also recompute via the admin RPCs.
 *
 * The function writes a `sync_log` row on entry (outcome=running) and
 * updates it on exit with the final outcome plus counts.
 */

// deno-types is provided by the Supabase Edge Runtime.
// @ts-ignore — module specifier resolved by Deno, not by Node type-checker.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

import { getAccessToken, type ServiceAccountKey } from './jwt.ts';
import { endpointToIso, listCalendarEvents } from './calendar.ts';

// Deno globals — the Node TS lib that Jest uses doesn't know about
// these, but Edge Runtime resolves them at runtime.
// @ts-ignore
declare const Deno: { env: { get(name: string): string | undefined } };

const PAST_DAYS = 30;
const FUTURE_DAYS = 14;

interface SyncOutcome {
  outcome: 'success' | 'error';
  upserted: number;
  deleted: number;
  error?: string;
}

function readEnvOrThrow(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`missing env var: ${name}`);
  return v;
}

function parseServiceAccountKey(raw: string): ServiceAccountKey {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(
      `GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON is not valid JSON: ${(e as Error).message}`,
    );
  }
  const obj = parsed as Partial<ServiceAccountKey>;
  if (!obj.client_email || !obj.private_key) {
    throw new Error('service account key missing client_email or private_key');
  }
  return obj as ServiceAccountKey;
}

async function runSync(): Promise<SyncOutcome> {
  const supabaseUrl = readEnvOrThrow('SUPABASE_URL');
  const serviceRoleKey = readEnvOrThrow('SUPABASE_SERVICE_ROLE_KEY');
  const calendarId = readEnvOrThrow('GOOGLE_CALENDAR_ID');
  const serviceAccountRaw = readEnvOrThrow('GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON');
  const key = parseServiceAccountKey(serviceAccountRaw);

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // sync_log open
  const { data: logRow, error: logErr } = await db
    .from('sync_log')
    .insert({ source: 'calendar', outcome: 'running' })
    .select('id')
    .single();
  if (logErr) throw new Error(`sync_log open failed: ${logErr.message}`);
  const logId = (logRow as { id: string }).id;

  let outcome: SyncOutcome = { outcome: 'success', upserted: 0, deleted: 0 };
  try {
    const now = new Date();
    const timeMin = new Date(now.getTime() - PAST_DAYS * 86_400_000);
    const timeMax = new Date(now.getTime() + FUTURE_DAYS * 86_400_000);

    const accessToken = await getAccessToken(key);
    const items = await listCalendarEvents({ calendarId, accessToken, timeMin, timeMax });

    // Project rows + skip events without resolvable timestamps.
    const rows: Array<{
      google_event_id: string;
      title: string;
      description: string | null;
      start_at: string;
      end_at: string;
    }> = [];
    for (const item of items) {
      const start = endpointToIso(item.start);
      const end = endpointToIso(item.end);
      if (!start || !end) continue;
      rows.push({
        google_event_id: item.id,
        title: item.summary ?? '(untitled)',
        description: item.description ?? null,
        start_at: start,
        end_at: end,
      });
    }

    // Compute is_counted via the SQL helper. One round-trip per row is
    // cheap at <200 events; if we ever scale up, batch into a single
    // RPC that returns matched ids.
    const enriched = await Promise.all(
      rows.map(async (r) => {
        const { data, error } = await db.rpc('match_counted_event', { title: r.title });
        if (error) throw new Error(`match_counted_event failed: ${error.message}`);
        return { ...r, is_counted: data === true, synced_at: new Date().toISOString() };
      }),
    );

    // Upsert by google_event_id (the unique key).
    if (enriched.length > 0) {
      const { error: upsertErr } = await db
        .from('events')
        .upsert(enriched, { onConflict: 'google_event_id' });
      if (upsertErr) throw new Error(`upsert failed: ${upsertErr.message}`);
    }

    // Delete rows that fell out of the window OR no longer exist
    // upstream. We can't use a single SQL `not in` of arbitrary length,
    // so we fetch existing ids in the window and diff in memory.
    const keepIds = new Set(enriched.map((r) => r.google_event_id));
    const { data: existing, error: existingErr } = await db
      .from('events')
      .select('id, google_event_id, start_at')
      .gte('start_at', timeMin.toISOString())
      .lt('start_at', timeMax.toISOString());
    if (existingErr) throw new Error(`fetch existing failed: ${existingErr.message}`);
    const stale: string[] = [];
    for (const row of (existing ?? []) as Array<{ id: string; google_event_id: string }>) {
      if (!keepIds.has(row.google_event_id)) stale.push(row.id);
    }
    // Also cull anything outside the window entirely.
    const { data: outOfWindow } = await db
      .from('events')
      .select('id')
      .or(`start_at.lt.${timeMin.toISOString()},start_at.gte.${timeMax.toISOString()}`);
    for (const row of (outOfWindow ?? []) as Array<{ id: string }>) stale.push(row.id);

    let deleted = 0;
    if (stale.length > 0) {
      const { error: delErr, count } = await db
        .from('events')
        .delete({ count: 'exact' })
        .in('id', stale);
      if (delErr) throw new Error(`delete stale failed: ${delErr.message}`);
      deleted = count ?? stale.length;
    }

    outcome = { outcome: 'success', upserted: enriched.length, deleted };
  } catch (e) {
    outcome = {
      outcome: 'error',
      upserted: 0,
      deleted: 0,
      error: (e as Error).message,
    };
  } finally {
    await db
      .from('sync_log')
      .update({
        finished_at: new Date().toISOString(),
        outcome: outcome.outcome,
        error: outcome.error ?? null,
        upserted: outcome.upserted,
        deleted: outcome.deleted,
      })
      .eq('id', logId);
  }

  return outcome;
}

// @ts-ignore — Deno.serve is provided by the Edge Runtime.
Deno.serve(async (_req: Request) => {
  try {
    const result = await runSync();
    const status = result.outcome === 'success' ? 200 : 500;
    return new Response(JSON.stringify(result), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    // Caught only if runSync's setup failed before the try/finally.
    return new Response(JSON.stringify({ outcome: 'error', error: (e as Error).message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
});
