## Context

Auth lands before any feature code so that every screen built afterward can assume `session != null`. Because we're Expo Go-first, we must avoid `@react-native-google-signin/google-signin` and any custom config plugin. Supabase's email/password flow is plain HTTP and works trivially in Expo Go; the magic link flow needs a redirect URL that survives the round-trip from email to Expo Go.

## Goals

- Servant-only login. No public sign-up.
- Two flows: email/password (preferred, fewer hops) and an emailed 6-digit one-time code (fallback for forgotten passwords; also serves as the invite mechanism long-term — the same email also includes a magic-link URL that production builds can honour through the `stminaconnect://` scheme).
- Persistent sessions across app restarts in Expo Go.
- Minimal `servants` table that later phases can extend without rewrites.
- Route guards that compose cleanly with Expo Router.

## Non-Goals

- Google Sign-In (requires native module + dev build).
- Apple Sign-In (same reason).
- Self-service password reset UI (use Supabase's built-in email template + magic link as a stand-in).
- In-app servant invitation (deferred to phase 13's admin dashboard).
- 2FA / SSO.
- Separate "member" auth (members do not log in, ever, in v1).

## Decisions

1. **`role` lives on `servants`, not in JWT custom claims.** Reasoning: <15 servants, role changes are rare, and RLS policies that read from `servants` keep the policy logic in one place. Custom claims would force a JWT refresh on role change, complicating ops.
2. **Email-code as the primary alternate flow; magic-link deep link as a production-only path.**
   - In Expo Go, the local GoTrue build silently rejects `exp://` redirect URLs (verified during phase implementation — even exact-match allow-list entries fall back to `site_url`). Rather than fight that, the in-app "Email me a code instead" path sends an OTP and the user types the 6-digit code Supabase already includes in every magic-link email. `supabase.auth.verifyOtp({ type: 'email' })` exchanges the code for a session.
   - The same email also carries a magic-link URL keyed to `redirect_to=stminaconnect://auth/callback`. Standalone builds (post-phase 16) register the scheme and `app/(auth)/callback.tsx` exchanges the code via `exchangeCodeForSession`. The route is wired now so that production activation is a config-only change, not a code change.
   - Allow-list (`supabase/config.toml`): contains `stminaconnect://auth/callback` only. No `exp://` entries are necessary because Expo Go users never tap the deep link — they type the code.
3. **AsyncStorage for session persistence.** Supabase JS supports this directly; no SecureStore in v1 (defer hardening to phase 15). Trade-off: a stolen device with no OS lock loses the session. Acceptable for v1 audience.
4. **Session refresh on app foreground.** Auth listener wired via `supabase.auth.onAuthStateChange`. Foreground hook calls `supabase.auth.getSession()` to detect expirations after long backgrounds.
5. **The `servants` row is the source of truth for "who am I"**, not `auth.users`. Auth only proves identity; `servants` carries display name and role. We join on app boot via an RPC `get_my_servant()` that reads `auth.uid()` and returns the row, or 401 if no servant exists for that user (means the user shouldn't have access — log them out).
6. **No public sign-up screen.** Removing the route entirely is safer than hiding it. Supabase project-level setting also disables sign-up via email.
7. **Login screen always uses email/password as default**, with an "Email me a code instead" link. The OTP path is one tap deeper. Passwords avoid email round-trips during the most common login path.
8. **Sign-out flow**: if the sync queue is empty, sign out immediately. If pending writes exist (impossible until `add-offline-sync-with-sqlite` lands), block with a Paper Dialog: "You have N unsynced changes. Logging out will discard them." Default action is "Stay logged in"; "Logout anyway" clears the queue and signs out. The dialog hook is documented here; the actual sync-queue check is wired in `add-offline-sync-with-sqlite` (which owns the queue). This is the canonical sign-out-with-pending behaviour for v1.
9. **Role enforcement deferred but plumbed.** The auth store exposes `role`. No screen filters on `role` yet (no admin-only screens exist). When admin screens are added (phase 11+), they read `role` from the store — no auth refactor needed.

## Risks / Trade-offs

- **Risk**: AsyncStorage tokens are unencrypted. Mitigated in phase 15 by migrating to SecureStore for the access token (refresh token can stay in AsyncStorage if needed) — backwards-compatible because AsyncStorage→SecureStore is a runtime read+rewrite.
- **Risk**: GoTrue's silent fallback when `exp://` redirects are rejected is non-obvious — a future contributor might wire an `exp://` entry into the allow-list expecting it to "just work". Mitigation: design.md and the README both call this out, and the OTP-code flow is the canonical dev path.
- **Trade-off**: requiring a manually-created `servants` row for the first cohort is friction, but it's a one-time admin setup. Phase 13's "Invite Servant" admin UI removes the friction permanently.

## Migration Plan

- New migration `001_servants.sql`: creates table, RLS enabled, two policies (self-read, admin-read-all). No data — admin creates rows manually.
- Rollback: `001_servants.down.sql` drops the table.
- After applying: admin manually creates one `auth.users` row + one `servants` row in the Dashboard for themselves to verify login.

## Deferred Work

- **Magic-link deep-link end-to-end verification — owned by `switch-to-development-build` (phase 16).** The route (`app/(auth)/callback.tsx`), the route's `exchangeCodeForSession` call, the `stminaconnect://` scheme in `app.json`, and the `additional_redirect_urls` entry in `supabase/config.toml` are all wired in this change. They aren't exercised in Expo Go because GoTrue silently rejects `exp://` redirects (see Decision 2). When phase 16 produces the first dev client with the `stminaconnect://` scheme registered, that build MUST verify the link is tappable end-to-end — phase 16's `tasks.md` § 5a tracks the acceptance steps. If the deep link fails there, the OTP-code path remains a working fallback; we'd debug GoTrue / scheme registration / allow-list as needed before shipping production.

## Open Questions

- None.
