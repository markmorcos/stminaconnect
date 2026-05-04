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
 * Logging: matches log `{ outcome, email, provisioned, ip, ua, ts }`,
 * where `provisioned` is true when this call had to (re-)create the
 * reviewer's auth user + servants row before minting the link;
 * mismatches log `{ outcome: 'no-match', ip, ua, ts }` *without* the
 * supplied email (it would be PII for real users who mistyped).
 *
 * Self-healing: if `generateLink('magiclink')` fails (typically a 500
 * "Database error finding user" when the reviewer's auth.users row is
 * absent), the function falls back to provisioning the reviewer
 * identity via `auth.admin.createUser` + a `servants` insert (matching
 * `scripts/provision-review-user.mjs`), then retries. Keeps the bypass
 * working when the one-shot provisioning step was skipped or the row
 * was deleted.
 *
 * Secrets:
 *   REVIEW_BYPASS_EMAIL — provisioned per environment by ops; when
 *     missing, the function self-provisions on first matching call.
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

  let actionLink = await tryGenerateLink(admin);
  let provisioned = false;

  // generateLink('magiclink') fails with 500 "Database error finding user"
  // when the reviewer's auth.users row is missing. The provisioning script
  // (scripts/provision-review-user.mjs) is meant to handle this once per
  // environment, but if it was skipped or the row was deleted, recover
  // here: ensure the auth user + matching servants row exist, then retry.
  // Idempotent — re-running once provisioned is a single listUsers call.
  if (!actionLink) {
    provisioned = await ensureReviewerProvisioned(admin);
    if (provisioned) {
      actionLink = await tryGenerateLink(admin);
    }
  }

  console.info(
    JSON.stringify({
      fn: 'review-login',
      outcome: actionLink ? 'issued' : 'generate-failed',
      email: REVIEW_BYPASS_EMAIL,
      provisioned,
      ip,
      ua,
      ts: new Date().toISOString(),
    }),
  );

  return ok(actionLink);
});

// deno-lint-ignore no-explicit-any
async function tryGenerateLink(admin: any): Promise<string | null> {
  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: REVIEW_BYPASS_EMAIL,
    });
    if (error) {
      console.error('review-login: generateLink failed', error);
      return null;
    }
    return data.properties?.action_link ?? null;
  } catch (e) {
    console.error('review-login: generateLink threw', e);
    return null;
  }
}

// Locates the reviewer's auth user by email, creating it (and the matching
// servants row) if missing. Returns true when, on exit, both rows exist.
// deno-lint-ignore no-explicit-any
async function ensureReviewerProvisioned(admin: any): Promise<boolean> {
  const email = REVIEW_BYPASS_EMAIL!;
  const target = email.trim().toLowerCase();

  let userId: string | null = null;
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error('review-login: listUsers failed', error);
      return false;
    }
    // deno-lint-ignore no-explicit-any
    const match = data.users.find((u: any) => (u.email ?? '').toLowerCase() === target);
    if (match) {
      userId = match.id;
      break;
    }
    if (data.users.length < 200) break;
  }

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { display_name: 'App Review' },
    });
    if (error || !data.user) {
      console.error('review-login: createUser failed', error);
      return false;
    }
    userId = data.user.id;
    console.warn('review-login: provisioned missing reviewer auth user', { userId });
  }

  // Insert the matching servants row. Without it, the auth store's
  // post-sign-in fetchMyServant returns null and signs the reviewer out
  // as an orphan. Idempotent: a unique-violation (23505) means a row
  // already exists, which is the desired terminal state.
  const { error: insertError } = await admin.from('servants').insert({
    id: userId,
    email,
    display_name: 'App Review',
    role: 'servant',
  });
  if (insertError && insertError.code !== '23505') {
    console.error('review-login: servants insert failed', insertError);
    return false;
  }

  return true;
}
