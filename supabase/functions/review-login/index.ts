/**
 * review-login — Edge Function that mints a one-shot OTP token-hash for the
 * single configured Play Console / App Store reviewer email so the app can
 * sign the reviewer in inline (no email, no SMS, no browser, no deeplink).
 *
 * Why this exists: app-store review runs on a clean device with no inbox
 * and no second-account access, so a normal magic-link email cannot reach
 * the reviewer. Supabase magic links are also single-use and expire (1h
 * default, 24h max) — a baked-in link in the listing dies long before
 * review starts. This function returns a *freshly-minted* `token_hash` on
 * every call, so a stable in-app affordance ("type the reviewer email →
 * tap Continue") works indefinitely.
 *
 * Why token_hash instead of action_link: an earlier iteration returned the
 * full `action_link` URL and let the client open it in the browser (which
 * 302s back into the app via `stminaconnect://auth/callback`). That works
 * for real users (PKCE flow surfaces the auth code as a query param) but
 * not for `generateLink({ type: 'magiclink' })` — there is no PKCE pairing,
 * so the redirect uses the implicit fragment flow, and the warm-start URL
 * listener in `app/auth/callback.tsx` races the deeplink delivery and
 * misses the URL → screen times out → reviewer bounced to /sign-in. The
 * token_hash path bypasses the browser entirely: the client calls
 * `supabase.auth.verifyOtp({ token_hash, type })` directly, which mints a
 * session locally with no redirect, no listener race, and no callback
 * screen involvement.
 *
 * Why server-only: `auth.admin.generateLink` requires the service role,
 * which can never ship to the client. Routing every sign-in attempt
 * through this function (rather than client-side branching on the email)
 * keeps `REVIEW_BYPASS_EMAIL` exclusively in Edge Function secrets — it
 * never appears in the JS bundle, `app.json`, `eas.json`, or any
 * `EXPO_PUBLIC_*` var.
 *
 * Body shape: { email: string }
 *
 * Responses:
 *   200 { token_hash, type }                                   — match: token_hash + verification type ('magiclink')
 *   200 { token_hash: null, type: null }                       — no match, missing/invalid body, generateLink failure, or missing secret.
 *                                                                Same shape so callers can fall through to the normal `signInWithOtp` flow.
 *   405 { error: 'method_not_allowed' }                        — non-POST.
 *
 * Logging: matches log `{ outcome: 'issued', email, ip, ua, ts }`;
 * mismatches log `{ outcome: 'no-match', ip, ua, ts }` *without* the
 * supplied email (it would be PII for real users who mistyped).
 *
 * Secrets:
 *   REVIEW_BYPASS_EMAIL — provisioned per environment by ops.
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — auto-injected by Supabase.
 */

// @ts-ignore — module specifier resolved by Deno, not Node type-checker.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// @ts-ignore — Deno globals are provided by the Edge Runtime.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve: (h: (req: Request) => Promise<Response>) => void;
};

type ReviewVerificationType = 'magiclink';

interface ReviewLoginResponse {
  token_hash: string | null;
  type: ReviewVerificationType | null;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function ok(payload: ReviewLoginResponse): Response {
  return jsonResponse(200, payload);
}

const NULL_RESPONSE: ReviewLoginResponse = { token_hash: null, type: null };

function clientIp(req: Request): string | null {
  // Supabase fronts Edge Functions with a proxy that sets x-forwarded-for.
  return req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? null;
}

const REVIEW_BYPASS_EMAIL = Deno.env.get('REVIEW_BYPASS_EMAIL');
if (!REVIEW_BYPASS_EMAIL) {
  // Visible in `supabase functions logs review-login` — flags
  // misconfiguration before anyone tries to sign in.
  console.warn(
    'review-login: REVIEW_BYPASS_EMAIL is not set; function will return null for every request',
  );
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'method_not_allowed' });
  }

  const ip = clientIp(req);
  const ua = req.headers.get('user-agent');

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return ok(NULL_RESPONSE);
  }

  const suppliedEmail =
    typeof (payload as { email?: unknown })?.email === 'string'
      ? (payload as { email: string }).email.trim().toLowerCase()
      : '';

  if (!REVIEW_BYPASS_EMAIL || suppliedEmail.length === 0) {
    console.info(
      JSON.stringify({
        fn: 'review-login',
        outcome: 'no-match',
        ip,
        ua,
        ts: new Date().toISOString(),
      }),
    );
    return ok(NULL_RESPONSE);
  }

  if (suppliedEmail !== REVIEW_BYPASS_EMAIL.trim().toLowerCase()) {
    console.info(
      JSON.stringify({
        fn: 'review-login',
        outcome: 'no-match',
        ip,
        ua,
        ts: new Date().toISOString(),
      }),
    );
    return ok(NULL_RESPONSE);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('review-login: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return ok(NULL_RESPONSE);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let tokenHash: string | null = null;
  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: REVIEW_BYPASS_EMAIL,
    });
    if (error) {
      console.error('review-login: generateLink failed', error);
    } else {
      tokenHash = data.properties?.hashed_token ?? null;
    }
  } catch (e) {
    console.error('review-login: generateLink threw', e);
  }

  console.info(
    JSON.stringify({
      fn: 'review-login',
      outcome: tokenHash ? 'issued' : 'generate-failed',
      email: REVIEW_BYPASS_EMAIL,
      ip,
      ua,
      ts: new Date().toISOString(),
    }),
  );

  return ok(tokenHash ? { token_hash: tokenHash, type: 'magiclink' } : NULL_RESPONSE);
});
