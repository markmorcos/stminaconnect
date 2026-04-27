/**
 * detect-absences — thin Edge Function that calls the SQL function
 * `public.detect_absences(null)` to run a full recompute.
 *
 * The actual detection logic lives in 020_detect_absences.sql; this
 * endpoint exists for two reasons:
 *
 *   1. Manual replays from ops (curl with the service role key).
 *   2. Future infra options (external schedulers, GitHub Actions cron)
 *      that prefer hitting an HTTP endpoint over running pg_cron.
 *
 * The reactive path (post-mark/unmark) and the in-database hourly
 * pg_cron schedule do NOT go through this function — they call the SQL
 * function directly for a faster path.
 */

// @ts-ignore — module specifier resolved by Deno, not Node type-checker.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// @ts-ignore — Deno globals are provided by the Edge Runtime.
declare const Deno: { env: { get(name: string): string | undefined } };

interface DetectOutcome {
  outcome: 'success' | 'error';
  inserted: number;
  error?: string;
}

function readEnvOrThrow(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`missing env var: ${name}`);
  return v;
}

async function runDetect(): Promise<DetectOutcome> {
  const supabaseUrl = readEnvOrThrow('SUPABASE_URL');
  const serviceRoleKey = readEnvOrThrow('SUPABASE_SERVICE_ROLE_KEY');

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await db.rpc('detect_absences', { p_person_ids: null });
  if (error) {
    return { outcome: 'error', inserted: 0, error: error.message };
  }
  return { outcome: 'success', inserted: typeof data === 'number' ? data : 0 };
}

// @ts-ignore — Deno.serve is provided by the Edge Runtime.
Deno.serve(async (_req: Request) => {
  try {
    const result = await runDetect();
    const status = result.outcome === 'success' ? 200 : 500;
    return new Response(JSON.stringify(result), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ outcome: 'error', error: (e as Error).message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
});
