## Context

Sign-in today is magic-link only: the user types an email, `signInWithOtp` sends a Supabase email, the user taps the link on the same device, and `app/auth/callback.tsx` exchanges the PKCE code for a session. Email/password is disabled at the project level. This is a deliberate v1 simplification (`auth/spec.md`).

Play Console review runs on a fresh test device with no inbox, no SMS, no second-account setup, and the reviewer cannot click email links. App Store review imposes the same constraints. With magic-link-only auth, the reviewer has no way to sign in, so App access fails and the build is rejected.

A baked-in magic link does not work either: Supabase magic links expire (default 1h, max 24h via `mailer_otp_exp`) and are single-use. Review can take days. By the time a reviewer opens the build, any pre-generated link is dead.

The fix has to give the reviewer a stable, copy-pasteable affordance whose **target is generated fresh on every use**. Supabase's `auth.admin.generateLink({ type: 'magiclink' })` is the only API that produces a valid magic link without user-side email interaction; it requires the service role and therefore must run server-side.

## Goals / Non-Goals

**Goals:**

- Make the app reviewable on a clean Play Store / App Store test device without violating store policy.
- Keep production sign-in for real servants byte-for-byte identical to today.
- Keep the reviewer email out of the app bundle, `app.json`, `eas.json`, and any `EXPO_PUBLIC_*` env var.
- Re-use the existing `app/auth/callback.tsx` deeplink handler — no new auth code path on the client.
- Fail closed: any Edge Function error degrades gracefully to the existing `signInWithOtp` flow so an outage cannot lock real users out.

**Non-Goals:**

- Adding password sign-in. The whole point of the v1 magic-link-only stance (`auth/spec.md`) is preserved.
- A self-service reviewer-account creator. The reviewer auth user + servants row are provisioned once, by hand, per environment.
- Hiding the existence of the bypass via cryptographic key checks. We rely on a non-guessable email local-part plus rate limiting and audit logging — not a shared client secret.
- Bypassing RLS or returning a session directly. The function only mints a real Supabase magic link; everything downstream (verify, callback, RLS) runs through the same code path real users use.

## Decisions

### Decision 1: Edge Function `review-login` is the sole bypass mechanism

**Choice:** A single Edge Function that takes `{ email }`, compares it server-side against `REVIEW_BYPASS_EMAIL`, and returns `{ link: action_link | null }`.

**Why:** `auth.admin.generateLink` requires the service role, which can never ship to the client. An Edge Function is the existing, established pattern in this repo (`supabase/functions/invite-servant/index.ts`, `delete-auth-user`) so there is no new infrastructure surface.

**Alternatives considered:**

- **Hardcoded OTP in client / "demo login" button.** Rejected: ships the bypass email and a magic-string OTP convention in the JS bundle, both decompilable from the APK.
- **Embed `REVIEW_BYPASS_KEY` query-param secret in the client.** Rejected: shipping any shared secret in the bundle is weaker than just keeping the discriminator (the email) server-side, and the email alone is already a strong-enough secret with a random local-part.
- **Pre-create one long-lived link and paste into Play Console.** Rejected: Supabase links are single-use and expire well before review windows close.
- **Add `signInWithPassword` for the reviewer.** Rejected: introduces a second auth surface to all users, contradicts the v1 magic-link-only requirement, and is more code than the Edge Function.

### Decision 2: Every sign-in routes through `review-login` first

**Choice:** `authStore.signInWithMagicLink` calls `supabase.functions.invoke('review-login', { body: { email } })` before doing anything else. If `link` is non-null, surface it via the dialog and stop. Otherwise fall through to today's `signInWithOtp` call.

**Why:** Keeps the reviewer email exclusively in Edge Function secrets. The client has no branching logic that depends on knowing the email, so even a fully-decompiled APK reveals nothing about who the reviewer is.

**Alternatives considered:**

- **Client-side compare against a hardcoded constant.** Cheaper (no extra round-trip on real sign-ins) but ships the email in the bundle. Visible to anyone who unzips the APK.
- **Two distinct sign-in entry points.** A "reviewer login" button alongside the email field. Rejected: adds a UI surface real users can stumble into, and either ships the email or still needs the Edge Function — no win.

**Tradeoff accepted:** every real sign-in pays one Edge Function round-trip. Sign-in is infrequent and warm-function latency (~100–300ms) is well below user perception thresholds. Cold-start latency (~1s) is also acceptable for a non-frequent action.

### Decision 3: Function returns the deeplink URL; client opens it via `Linking.openURL`

**Choice:** Function returns `properties.action_link` from `generateLink`. UI shows a dialog with a "Sign in" button. Tapping calls `Linking.openURL(link)`, which routes through Supabase's `/auth/v1/verify` and 302s to `stminaconnect://auth/callback#access_token=…&refresh_token=…`. The existing fragment-based path in `app/auth/callback.tsx:84-93` calls `setSession` and the auth store finishes the flow.

**Why:** The PKCE / fragment handling in `app/auth/callback.tsx` is already production-tested. Reusing it means zero new client auth code, and the reviewer's session is created exactly the same way a real user's is — same RLS, same `fetchMyServant` join, same `onAuthStateChange` wiring.

**Alternatives considered:**

- **Return `token_hash` and call `verifyOtp` from the client.** Works, but adds a code path in the auth store that doesn't exist today and skips the deeplink leg the existing callback already handles.
- **Function 302-redirects directly to Supabase verify.** Lets us put a stable HTTPS URL in Play Console reviewer instructions instead of a button. Rejected as primary because it makes `review-login` discoverable as an auth bypass via URL inspection. Kept as a future option if reviewer instructions ever need a paste-able link.

### Decision 4: Non-guessable bypass email defeats enumeration

**Choice:** Reviewer email uses a random 8-hex-char local-part: `playreview-<8 hex>@stminaconnect.app`.

**Why:** The function discriminates response shape (link vs. null) on email match, which is an enumeration oracle. Rate limits help but aren't sufficient. A 32-bit random local-part puts brute-force at ~17 days at 60 req/sec — practically infeasible. The full email goes into Play Console reviewer instructions verbatim; reviewers paste, they don't guess.

**Alternatives considered:**

- **Constant-time email compare alone.** Hides timing but not response-shape — the oracle remains.
- **Per-IP rate limit only.** Defeats casual enumeration but not a distributed attacker. The random local-part raises the floor regardless.

### Decision 5: Reviewer user provisioned once, by hand, per environment

**Choice:** A one-time `supabase.auth.admin.createUser({ email, email_confirm: true })` plus an `INSERT` into `servants`, executed via a small admin script or the Supabase dashboard SQL editor. No automated provisioning.

**Why:** This is a once-per-environment operation. Automating it adds a code path that can fail in production for no operational benefit. The provisioning script is small and lives in `scripts/` so it can be re-run on a fresh project.

**Alternatives considered:**

- **Reuse `invite-servant` Edge Function.** Works, but sends an invite email to the bypass address. Cleaner to create the user directly with `email_confirm: true`.
- **SQL migration that seeds the user.** Rejected — auth users go through `auth.admin.createUser`, not raw SQL, and seeding identity records via migrations couples deployment to a specific email.

## Risks / Trade-offs

- **`review-login` becomes part of the critical sign-in path.** If the function is down, no one can sign in.
  → Mitigation: wrap the `supabase.functions.invoke` call in `try/catch`. On any error or timeout, fall through to today's `signInWithOtp` so the failure mode is "reviewer cannot use bypass" rather than "no one can sign in."

- **Enumeration discovers the bypass email.** Anyone who suspects a bypass exists could probe.
  → Mitigation: 8-hex-char random local-part raises brute-force cost to ~17 days at 60 req/sec; per-IP rate limit on the function caps practical throughput; every hit logs IP + UA so unexpected usage is detectable.

- **Compromise of the reviewer account.** If the email leaks, anyone can mint a session.
  → Mitigation: provision the reviewer with the _minimum_ role needed for review (start with a non-admin servant; only escalate if review specifically tests admin features). Seed the demo parish with non-PII placeholder data. Rotate the email post-approval if a leak is suspected — generate a new random local-part, re-provision, update Play Console instructions.

- **`app.json` reviewer-instruction fields drift from the actual provisioned email.** Easy to mismatch.
  → Mitigation: store the canonical email in the store-readiness runbook (single source of truth); any rotation updates the runbook and the Edge Function secret in the same step.

- **Latency added to every real sign-in.** Edge Function round-trip on the warm path; cold-start on the first sign-in after deploy.
  → Mitigation: accepted. Sign-in is rare enough that the latency is invisible; the alternative (client-side email check) trades user-visible latency for a leaked secret in the bundle, which is a worse trade.

- **Function logs PII (the reviewer's email and IP) in plaintext.**
  → Mitigation: only log the _bypass account's_ email/IP — never the email the requester typed. Anything that didn't match logs only "no-match" with the IP, not the supplied address.

## Migration Plan

1. Land the Edge Function and `authStore` change behind no flag — it's strictly additive (returns null on non-match) and the `try/catch` around the invoke ensures graceful degradation.
2. Set the `REVIEW_BYPASS_EMAIL` secret in the production Supabase project: `supabase secrets set REVIEW_BYPASS_EMAIL=playreview-<8 hex>@stminaconnect.app --project-ref <prod>`.
3. Provision the reviewer `auth.users` row + `servants` row in production (one-shot script under `scripts/`).
4. Deploy the Edge Function: `supabase functions deploy review-login --project-ref <prod>`.
5. Smoke-test: type the reviewer email in a production build, confirm the dialog appears with a working link, complete sign-in, verify the resulting session lands on the home screen.
6. Update `marketing/` Play Console reviewer instructions and the store-readiness runbook with the email.
7. Rollback: if the function misbehaves, delete the deployed function — `try/catch` in `authStore` falls back to today's `signInWithOtp` automatically. No client rollback required.

## Open Questions

- Which servant role does the reviewer account need? Default to non-admin (least privilege); revisit if review requires admin-only screens.
- Should the demo parish be a real parish row or a synthetic placeholder? Synthetic is safer (no PII risk) but may not exercise enough of the app for a thorough review.
- Do we want to also add the 302-redirect mode (Decision 3 alternative) so the Play Console listing can show a copy-paste URL instead of an email-then-tap dialog? Defer until we see how the dialog flow performs in actual review.
