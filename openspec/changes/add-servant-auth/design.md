## Context

Auth lands before any feature code so that every screen built afterward can assume `session != null`. Because we're Expo Go-first, we must avoid `@react-native-google-signin/google-signin` and any custom config plugin. Supabase's email/password flow is plain HTTP and works trivially in Expo Go; the magic link flow needs a redirect URL that survives the round-trip from email to Expo Go.

## Goals

- Servant-only login. No public sign-up.
- Two flows: email/password (preferred, fewer hops) and magic link (fallback for forgotten passwords; also serves as the invite mechanism long-term).
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
2. **Magic-link redirect URL strategy** (resolves Open Question A3):
   - Dev (Expo Go): `exp://192.168.x.x:8081/--/auth/callback` — Expo's Linking API resolves at runtime and Supabase accepts it as a redirect URL when configured in the dashboard.
   - Production (post-phase 16): `stminaconnect://auth/callback`.
   - Both URLs are added to Supabase Auth's allow-list in the Dashboard.
3. **AsyncStorage for session persistence.** Supabase JS supports this directly; no SecureStore in v1 (defer hardening to phase 15). Trade-off: a stolen device with no OS lock loses the session. Acceptable for v1 audience.
4. **Session refresh on app foreground.** Auth listener wired via `supabase.auth.onAuthStateChange`. Foreground hook calls `supabase.auth.getSession()` to detect expirations after long backgrounds.
5. **The `servants` row is the source of truth for "who am I"**, not `auth.users`. Auth only proves identity; `servants` carries display name and role. We join on app boot via an RPC `get_my_servant()` that reads `auth.uid()` and returns the row, or 401 if no servant exists for that user (means the user shouldn't have access — log them out).
6. **No public sign-up screen.** Removing the route entirely is safer than hiding it. Supabase project-level setting also disables sign-up via email.
7. **Login screen always uses email/password as default**, with a "Email me a link instead" link. Magic-link is one tap deeper. Passwords avoid email round-trips during the most common login path.
8. **Sign-out flow**: if the sync queue is empty, sign out immediately. If pending writes exist (impossible until `add-offline-sync-with-sqlite` lands), block with a Paper Dialog: "You have N unsynced changes. Logging out will discard them." Default action is "Stay logged in"; "Logout anyway" clears the queue and signs out. The dialog hook is documented here; the actual sync-queue check is wired in `add-offline-sync-with-sqlite` (which owns the queue). This is the canonical sign-out-with-pending behaviour for v1.
9. **Role enforcement deferred but plumbed.** The auth store exposes `role`. No screen filters on `role` yet (no admin-only screens exist). When admin screens are added (phase 11+), they read `role` from the store — no auth refactor needed.

## Risks / Trade-offs

- **Risk**: AsyncStorage tokens are unencrypted. Mitigated in phase 15 by migrating to SecureStore for the access token (refresh token can stay in AsyncStorage if needed) — backwards-compatible because AsyncStorage→SecureStore is a runtime read+rewrite.
- **Risk**: Magic-link redirect URL is fragile across LAN IP changes during dev. Mitigation: documented `EXPO_PUBLIC_DEV_REDIRECT_URL` override in `.env.local`.
- **Trade-off**: requiring a manually-created `servants` row for the first cohort is friction, but it's a one-time admin setup. Phase 13's "Invite Servant" admin UI removes the friction permanently.

## Migration Plan

- New migration `001_servants.sql`: creates table, RLS enabled, two policies (self-read, admin-read-all). No data — admin creates rows manually.
- Rollback: `001_servants.down.sql` drops the table.
- After applying: admin manually creates one `auth.users` row + one `servants` row in the Dashboard for themselves to verify login.

## Open Questions

- None.
