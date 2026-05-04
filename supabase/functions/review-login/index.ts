/**
 * review-login — Edge Function that issues a fresh Supabase magic link
 * for the single configured Play Console / App Store reviewer email.
 *
 * Why this exists: Play Console and App Store review run on a clean
 * test device with no inbox, no SMS, and no second-account setup, so a
 * reviewer cannot click an email magic link. Supabase magic links are
 * also single-use and expire (default 1h, max 24h) — far shorter than
 * the typical review window — so a baked-in link does not work either.
 * This function returns a *freshly-minted* `action_link` on every call,
 * so a stable in-app affordance ("type the reviewer email → tap the
 * link in the dialog that appears") works indefinitely.
 *
 * Why it is the sole bypass mechanism: `auth.admin.generateLink` requires
 * the service role, which can never ship to the client. Routing every
 * sign-in through this function (rather than client-side branching)
 * keeps the bypass email exclusively in Edge Function secrets — never
 * in the JS bundle, `app.json`, `eas.json`, or any `EXPO_PUBLIC_*` var.
 *
 * Body shape: { email: string }
 *
 * Responses:
 *   200 { link: string | null }     — `link` is a fresh action_link when
 *                                     `email` matches REVIEW_BYPASS_EMAIL
 *                                     (case-insensitive, trimmed); null
 *                                     for every other case (mismatch,
 *                                     missing/invalid body, generateLink
 *                                     failure, or a missing secret).
 *                                     The shape is identical so callers
 *                                     can fall through to the normal
 *                                     `signInWithOtp` flow on null.
 *   405 { error: 'method_not_allowed' } — non-POST.
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

interface ReviewLoginResponse {
  link: string | null;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function ok(link: string | null): Response {
  return jsonResponse(200, { link } satisfies ReviewLoginResponse);
}

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
    return ok(null);
  }

  const suppliedEmail =
    typeof (payload as { email?: unknown })?.email === 'string'
      ? (payload as { email: string }).email.trim().toLowerCase()
      : '';
  // Forwarded to `generateLink`'s `options.redirectTo` so Supabase's verify
  // endpoint 302s straight to the app's custom-scheme deeplink instead of
  // the project's default Site URL (which would land in a browser and the
  // app's `/auth/callback` would never fire). Same `Linking.createURL(...)`
  // value the standard `signInWithOtp` flow already uses.
  const redirectTo =
    typeof (payload as { redirectTo?: unknown })?.redirectTo === 'string'
      ? (payload as { redirectTo: string }).redirectTo.trim()
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
    return ok(null);
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
    return ok(null);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('review-login: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return ok(null);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let actionLink: string | null = null;
  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: REVIEW_BYPASS_EMAIL,
      options: redirectTo ? { redirectTo } : undefined,
    });
    if (error) {
      console.error('review-login: generateLink failed', error);
    } else {
      actionLink = data.properties?.action_link ?? null;
    }
  } catch (e) {
    console.error('review-login: generateLink threw', e);
  }

  console.info(
    JSON.stringify({
      fn: 'review-login',
      outcome: actionLink ? 'issued' : 'generate-failed',
      email: REVIEW_BYPASS_EMAIL,
      ip,
      ua,
      ts: new Date().toISOString(),
    }),
  );

  return ok(actionLink);
});
