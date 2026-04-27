/**
 * invite-servant — Edge Function that creates a new auth.users row for
 * a newly-invited servant, sends them a magic-link sign-in email, and
 * inserts the matching `servants` row.
 *
 * Why an Edge Function rather than a SQL RPC? Creating an auth.users
 * row requires the service role key — and exposing the service role
 * key to a SECURITY DEFINER SQL function would give every authenticated
 * client a write surface to auth.users. The Edge Function holds the
 * service role key in its environment (Supabase secrets), and verifies
 * the caller's JWT identifies an admin servant before doing anything.
 *
 * Body shape: { email, displayName?, role?, redirectTo? }
 *   redirectTo — where the magic link should land after the user clicks
 *   it from the invite email. Forwarded to Supabase Auth verbatim. The
 *   client computes it via `Linking.createURL('/auth/callback')` so the
 *   URL has the right scheme for the runtime (Expo Go vs dev-build vs
 *   production). MUST appear in `auth.additional_redirect_urls` (or
 *   match a glob there) or Supabase rejects it with "Invalid redirect
 *   URL".
 *
 * Responses:
 *   200 { servant: SERVANT_ROW }     — invite sent, servants row inserted
 *   400 { error: string }            — body validation failed
 *   401 { error: 'unauthorized' }    — missing or unparseable Authorization
 *   403 { error: 'forbidden' }       — caller is not an active admin
 *   409 { error: string }            — email already registered
 *   500 { error: string }            — unexpected failure
 */

// @ts-ignore — module specifier resolved by Deno, not Node type-checker.
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// @ts-ignore — Deno globals are provided by the Edge Runtime.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve: (h: (req: Request) => Promise<Response>) => void;
};

interface InviteBody {
  email: string;
  displayName?: string;
  role?: 'admin' | 'servant';
  redirectTo?: string;
}

interface ServantRow {
  id: string;
  email: string;
  display_name: string | null;
  role: 'admin' | 'servant';
  created_at: string;
  updated_at: string;
  deactivated_at: string | null;
}

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

function parseBody(payload: unknown): InviteBody | { error: string } {
  if (typeof payload !== 'object' || payload === null) {
    return { error: 'invalid_body' };
  }
  const p = payload as Record<string, unknown>;
  const email = typeof p.email === 'string' ? p.email.trim().toLowerCase() : '';
  if (email.length === 0 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'invalid_email' };
  }
  const displayName = typeof p.displayName === 'string' ? p.displayName.trim() : undefined;
  const roleRaw = typeof p.role === 'string' ? p.role : 'servant';
  if (roleRaw !== 'admin' && roleRaw !== 'servant') {
    return { error: 'invalid_role' };
  }
  const redirectTo = typeof p.redirectTo === 'string' ? p.redirectTo.trim() : undefined;
  return {
    email,
    displayName: displayName || undefined,
    role: roleRaw,
    redirectTo: redirectTo || undefined,
  };
}

async function verifyAdmin(supabaseUrl: string, anonKey: string, jwt: string): Promise<boolean> {
  const callerClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data, error } = await callerClient.rpc('is_admin');
  if (error) return false;
  return data === true;
}

async function inviteServant(
  admin: SupabaseClient,
  body: InviteBody,
): Promise<{ servant: ServantRow } | { error: string; status: number }> {
  const inviteResp = await admin.auth.admin.inviteUserByEmail(body.email, {
    data: { display_name: body.displayName ?? null },
    redirectTo: body.redirectTo,
  });
  if (inviteResp.error) {
    const msg = inviteResp.error.message ?? 'invite_failed';
    const status = /already.*registered|exists/i.test(msg) ? 409 : 500;
    return { error: msg, status };
  }
  const newUserId = inviteResp.data.user?.id;
  if (!newUserId) {
    return { error: 'invite_returned_no_user', status: 500 };
  }

  const insertResp = await admin
    .from('servants')
    .insert({
      id: newUserId,
      email: body.email,
      display_name: body.displayName ?? null,
      role: body.role ?? 'servant',
    })
    .select('*')
    .single();
  if (insertResp.error) {
    return { error: insertResp.error.message, status: 500 };
  }
  return { servant: insertResp.data as ServantRow };
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

  const isAdmin = await verifyAdmin(supabaseUrl, anonKey, callerJwt);
  if (!isAdmin) {
    return jsonResponse(403, { error: 'forbidden' });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { error: 'invalid_json' });
  }
  const parsed = parseBody(payload);
  if ('error' in parsed) {
    return jsonResponse(400, parsed);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const result = await inviteServant(adminClient, parsed);
    if ('error' in result) {
      return jsonResponse(result.status, { error: result.error });
    }
    return jsonResponse(200, result);
  } catch (e) {
    return jsonResponse(500, { error: (e as Error).message });
  }
});
