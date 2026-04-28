/**
 * delete-auth-user — Edge Function that removes the caller's auth.users
 * row after `erase_my_account()` has anonymized references and dropped
 * the corresponding `servants` row in Postgres.
 *
 * Why an Edge Function and not a SQL RPC? Removing an auth.users row
 * requires the service role key, which we never expose to a SECURITY
 * DEFINER function (every authenticated client could trigger it). The
 * Edge Function holds the service role key in its environment and
 * verifies the caller's JWT identifies the user being deleted before
 * doing anything.
 *
 * The function is invoked by the mobile client immediately after the
 * `erase_my_account` RPC succeeds. The session is signed out client-side
 * once this function returns 200.
 *
 * Request body: none required. The user_id is derived from the JWT — a
 * user can only delete themselves through this function. (Admins use a
 * separate flow not exposed in v1.)
 *
 * Responses:
 *   200 { deleted: true }            — auth user removed
 *   401 { error: 'unauthorized' }    — missing or unparseable Authorization
 *   500 { error: string }            — unexpected failure
 */

// @ts-ignore — module specifier resolved by Deno, not Node type-checker.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// @ts-ignore — Deno globals are provided by the Edge Runtime.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve: (h: (req: Request) => Promise<Response>) => void;
};

function readEnvOrThrow(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`missing env var: ${name}`);
  return v;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function getCallerUserId(
  supabaseUrl: string,
  anonKey: string,
  jwt: string,
): Promise<string | null> {
  const callerClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data, error } = await callerClient.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'method_not_allowed' });
  }

  const supabaseUrl = readEnvOrThrow('SUPABASE_URL');
  const anonKey = readEnvOrThrow('SUPABASE_ANON_KEY');
  const serviceRoleKey = readEnvOrThrow('SUPABASE_SERVICE_ROLE_KEY');

  const authHeader = req.headers.get('authorization') ?? '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return jsonResponse(401, { error: 'unauthorized' });
  }
  const callerJwt = match[1];

  const userId = await getCallerUserId(supabaseUrl, anonKey, callerJwt);
  if (!userId) {
    return jsonResponse(401, { error: 'unauthorized' });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { error } = await adminClient.auth.admin.deleteUser(userId);
    if (error) {
      return jsonResponse(500, { error: error.message });
    }
    return jsonResponse(200, { deleted: true });
  } catch (e) {
    return jsonResponse(500, { error: (e as Error).message });
  }
});
