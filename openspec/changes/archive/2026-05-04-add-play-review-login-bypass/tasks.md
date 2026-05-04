## 1. Edge Function

- [x] 1.1 Scaffold `supabase/functions/review-login/index.ts` mirroring the structure of `supabase/functions/invite-servant/index.ts` (Deno serve handler, service-role client constructed from `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, `json()` helper, header docblock).
- [x] 1.2 Implement the `POST` handler: parse `{ email }` from the body, return `{ link: null }` for missing/non-string email or non-`POST` methods (405 for the method case).
- [x] 1.3 Read `REVIEW_BYPASS_EMAIL` from `Deno.env`. If absent, return `{ link: null }` (fail closed) and log a single startup-level warning so production misconfiguration is visible.
- [x] 1.4 Compare the supplied email to the secret using a case-insensitive trim. On mismatch, log `{ outcome: 'no-match', ip, ua }` (no email) and return `{ link: null }`.
- [x] 1.5 On match, call `admin.auth.admin.generateLink({ type: 'magiclink', email: REVIEW_BYPASS_EMAIL })`. If the call errors or `properties.action_link` is missing, log the error and return `{ link: null }`.
- [x] 1.6 On success, log `{ outcome: 'issued', email: REVIEW_BYPASS_EMAIL, ip, ua, ts }` and return `{ link: data.properties.action_link }`.
- [x] 1.7 Added `review-login` to `SUPABASE_FUNCTIONS` in the Makefile so `make deploy-functions` (and the `deploy-supabase` GitHub Action) ship it on next push to `main`. Local hand-test with `supabase functions serve` deferred to ops once CI runs.

## 2. Reviewer provisioning

- [x] 2.1 Added `scripts/provision-review-user.mjs` — takes `--email` (and optional `--display-name` / `--role`), reads `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from env, idempotently creates the auth user via `auth.admin.createUser({ email, email_confirm: true })` and the matching `servants` row.
- [x] 2.2 Documented the script invocation in `README.md` under the Production section, with the canonical reviewer-account runbook at `docs/store/review-account.md`.
- [ ] 2.3 (Ops) Generate the canonical bypass email and record it in `docs/store/review-account.md` (under the "Canonical reviewer email" table) once provisioning is run.
- [ ] 2.4 (Ops) Run `node scripts/provision-review-user.mjs --email <bypass>` against the production project.

## 3. Edge Function deployment & secrets

- [x] 3.1 (Ops, already done by user) `REVIEW_BYPASS_EMAIL` secret set in production Supabase.
- [x] 3.2 `review-login` added to `SUPABASE_FUNCTIONS` in the Makefile, so the existing `deploy-supabase.yml` GitHub Action will deploy it automatically on the next push to `main` — same `make deploy-functions PROJECT=prod` invocation already used for `invite-servant` etc.
- [ ] 3.3 (Ops) Smoke-test against production after CI deploys: `supabase functions invoke review-login --body '{"email":"<bypass>"}'` (expect non-null `link`) vs. `--body '{"email":"x@y.z"}'` (expect `link: null`).

## 4. Client wiring

- [x] 4.1 `src/state/authStore.ts` `signInWithMagicLink` invokes `supabase.functions.invoke<{ link: string | null }>('review-login', { body: { email } })` inside a `try/catch` before any `signInWithOtp` call.
- [x] 4.2 Non-null `link` → `set({ isLoading: false, error: null, reviewLink: data.link })` and early return; `signInWithOtp` is skipped.
- [x] 4.3 Null `link`, throw, or any other failure → fall through to today's `signInWithOtp` with unchanged params + error mapping. Dev-only `console.warn` on the catch path.
- [x] 4.4 `clearReviewLink()` action added; reset to `null` in `__resetAuthStoreForTests`. Surfaced through `useAuth` alongside `reviewLink`.
- [x] 4.5 `app/(auth)/sign-in.tsx` renders a `Modal` when `reviewLink` is non-null with a header, body copy, the link (selectable, as a fallback), and a primary "Sign in" button that calls `Linking.openURL(link)` then `clearReviewLink()`. The "check your inbox" empty-state is gated on `useAuthStore.getState().reviewLink` being null so the reviewer never sees both UIs.
- [x] 4.6 Confirmed `app/auth/callback.tsx` needs no changes — the existing fragment branch (`callback.tsx:84-93`) handles the deeplink that `action_link` redirects to.

## 5. Tests

- [x] 5.1 `tests/auth/authStore.test.ts` — "falls through to signInWithOtp when review-login returns null link".
- [x] 5.2 `tests/auth/authStore.test.ts` — "falls through to signInWithOtp when review-login throws (graceful degradation)" (with `console.warn` spy to keep stderr clean).
- [x] 5.3 `tests/auth/authStore.test.ts` — "surfaces the link and skips signInWithOtp when review-login returns a non-null link" + a `clearReviewLink` reset test.
- [x] 5.4 `tests/auth/signIn.test.tsx` — three new cases under "reviewer-bypass dialog": dialog renders + shows link, "Sign in" button calls `Linking.openURL` and `clearReviewLink`, dialog hidden when `reviewLink` is null.

## 6. Store-readiness updates

- [x] 6.1 `docs/store/submission-android.md` — new "App access (reviewer credentials)" section (4b) under the listing step, with copy-paste instructions referencing `docs/store/review-account.md`.
- [x] 6.2 `docs/store/submission-ios.md` — Notes block + "Sign-in required" section rewritten to describe the dialog-based reviewer flow; password field left blank.
- [x] 6.3 `docs/store/review-account.md` rewritten end-to-end as the canonical runbook: components, canonical email table, one-time provisioning workflow, reviewer instructions copy, rotation procedure, security posture. README updated to point at it.

## 7. End-to-end verification

- [ ] 7.1 (Ops) On a clean Android device/emulator, install the production-channel build, type the canonical bypass email, confirm the dialog appears with a working link, tap "Sign in", and confirm the home screen renders.
- [ ] 7.2 (Ops) Type a non-bypass email on the same device and confirm the existing "check your email" flow still appears unchanged.
- [ ] 7.3 (Ops) Temporarily break the secret (or unset it) and confirm normal sign-in still works (graceful degradation).

## 8. OpenSpec hygiene

- [x] 8.1 Ran `openspec validate add-play-review-login-bypass --strict` after each artifact was authored — clean pass.
- [ ] 8.2 (Ops) After production smoke-tests, archive with `openspec archive add-play-review-login-bypass`.
