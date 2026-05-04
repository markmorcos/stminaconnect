# Add Play Console reviewer login bypass

## Why

Google Play Console (and App Store) review requires test credentials that work on a clean device with no inbox, no SMS, no second-account setup, and no clicking through emails the reviewer cannot read. Our current sign-in is magic-link only (`auth/spec.md`), which makes the app unreviewable as-is — a baked-in magic link expires within an hour, and reviewers cannot click links delivered to an inbox they don't own. Without a deterministic sign-in path we will fail App access review and the build will be rejected.

## What Changes

- Add a new Supabase Edge Function `review-login` that, when invoked with the configured reviewer email, generates a fresh magic link via the service role and returns its `action_link` URL. For any other email, it returns `{ link: null }` and does nothing.
- Route every sign-in attempt through `review-login` first (from the existing sign-in screen). If a link comes back, surface it in a dialog with a "Sign in" action that deeplinks through Supabase verify into the existing `stminaconnect://auth/callback` handler. Otherwise fall through to the unchanged `signInWithOtp` flow.
- One-time provision a reviewer auth user (`auth.admin.createUser` with `email_confirm: true`) and a matching `servants` row, so the generated magic link resolves to a real session and `fetchMyServant()` does not orphan-sign-out the reviewer.
- Store the reviewer email in Supabase Edge Function secrets as `REVIEW_BYPASS_EMAIL` — never in the app bundle, `app.json`, `eas.json`, or any `EXPO_PUBLIC_*` variable. Use a non-guessable random local-part (e.g. `playreview-<8 hex>@stminaconnect.app`) to defeat enumeration.
- Document the reviewer credential and any provisioning steps in the store-readiness runbook so future submissions reuse the same account.

## Capabilities

### New Capabilities

<!-- None — this change extends an existing capability. -->

### Modified Capabilities

- `auth`: adds a reviewer-bypass requirement that runs ahead of the existing magic-link send, plus a non-functional requirement that the bypass email never ships in the client bundle.
- `store-readiness`: documents the reviewer credentials and one-time provisioning step in the Play / App Store submission runbook.

## Impact

- **New code**: `supabase/functions/review-login/index.ts` (mirrors the `invite-servant` shape).
- **Modified code**: `src/state/authStore.ts` — `signInWithMagicLink` calls `review-login` first; on a non-null `link`, it stops short of `signInWithOtp` and surfaces the link to the UI. Sign-in screen (`app/sign-in.tsx` and/or `src/features/account/...`) renders a dialog with the link and a "Sign in" button that calls `Linking.openURL`.
- **No client-side secret**: the reviewer email lives only in Edge Function secrets. The function key concept from earlier drafts is dropped — no shared secret is shipped to the client.
- **One-time ops**: provision the reviewer auth user + servants row once per environment (production primarily; preview optional).
- **Auth callback**: no changes needed — the existing PKCE / fragment handling in `app/auth/callback.tsx` covers the deeplink that `action_link` redirects to.
- **Availability**: `review-login` is now in the critical path of every sign-in. Mitigated by wrapping the invoke in `try/catch` and falling through to `signInWithOtp` on any function error so a function outage degrades gracefully back to today's behavior.
- **Observability**: function logs every hit (timestamp, IP, UA) so unexpected use of the bypass account is detectable.
