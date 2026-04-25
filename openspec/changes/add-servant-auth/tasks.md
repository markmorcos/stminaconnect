# Tasks — add-servant-auth

## 1. Database

- [ ] 1.1 Create migration `001_servants.sql`: `servants` table with `id` (uuid PK, FK `auth.users.id`), `email` (text not null), `display_name` (text), `role` (text enum check `('admin','servant')`, not null default `'servant'`), `created_at` (timestamptz default now()), `updated_at` (timestamptz default now()), `deactivated_at` (timestamptz null)
- [ ] 1.2 Enable RLS on `servants`. Policies:
  - `servants_self_read`: `auth.uid() = id`
  - `servants_admin_read_all`: `EXISTS (SELECT 1 FROM servants s WHERE s.id = auth.uid() AND s.role = 'admin')`
- [ ] 1.3 RPC `get_my_servant() RETURNS servants` — security-definer; reads `auth.uid()`; returns matching row or null
- [ ] 1.4 `make migrate-up` succeeds; rollback `001_servants.down.sql` also written

## 2. Supabase client wiring

- [ ] 2.1 Configure `supabase` client in `src/services/api/supabase.ts`:
  - `auth.persistSession: true`
  - `auth.storage: AsyncStorage`
  - `auth.detectSessionInUrl: false` (RN — we handle deep links manually)
- [ ] 2.2 Add `services/api/servants.ts` exposing `fetchMyServant()` calling `get_my_servant` RPC

## 3. Auth state store

- [ ] 3.1 `src/state/authStore.ts` (Zustand): state `{ session, servant, isLoading, error }`, actions `signIn`, `signInWithMagicLink`, `signOut`, `refresh`
- [ ] 3.2 On store init: `supabase.auth.getSession()` → if session, fetch servant via RPC → store both
- [ ] 3.3 Subscribe to `supabase.auth.onAuthStateChange`: update session, refetch servant on sign-in, clear on sign-out
- [ ] 3.4 Hook `useAuth()` exporting store slice for components

## 4. Sign-in screen

- [ ] 4.1 `app/(auth)/_layout.tsx` — Stack; if `session` present, redirect to `/`
- [ ] 4.2 `app/(auth)/sign-in.tsx`:
  - Default mode: email + password fields, "Sign in" button (RHF + Zod)
  - Toggle link: "Email me a magic link instead"
  - Magic link mode: email field only, "Send link" button
  - Error display via Paper Snackbar
- [ ] 4.3 `app/(auth)/callback.tsx` — handles deep link from magic link; calls `supabase.auth.exchangeCodeForSession` if applicable; routes to `/`

## 5. Authenticated layout + guard

- [ ] 5.1 `app/(app)/_layout.tsx` — Stack; if no session, redirect to `/(auth)/sign-in`
- [ ] 5.2 Move placeholder home from `app/index.tsx` → `app/(app)/index.tsx`. New home shows servant `displayName` and a "Sign out" button.
- [ ] 5.3 If authenticated user has no `servants` row (RPC returns null) → sign out + show error "Account not configured. Contact your admin."

## 6. Deep linking

- [ ] 6.1 Add to `app.json`: `scheme: "stminaconnect"` (will only matter post-phase 16, but define now)
- [ ] 6.2 Document in README: how to derive the dev redirect URL from `npx expo start` output and add it to Supabase Dashboard's allowed redirect URLs

## 7. Tests

- [ ] 7.1 Unit: `authStore` — sign-in success path, sign-in failure path, sign-out clears state, magic-link success path
- [ ] 7.2 Integration (against local Supabase): RPC `get_my_servant` returns own row; returns null when no servant row exists
- [ ] 7.3 Integration: RLS — servant cannot read another servant's row; admin can read all rows
- [ ] 7.4 Component: sign-in screen renders both modes; submit calls store action with form values

## 8. Verification (in Expo Go)

- [ ] 8.1 Manually create one `auth.users` + `servants` row via Supabase Dashboard
- [ ] 8.2 Sign in with email/password — lands on home screen showing display name
- [ ] 8.3 Sign out — back to sign-in screen
- [ ] 8.4 Sign in with magic link — receive email, tap link on phone, app opens via `exp://...` and lands on home
- [ ] 8.5 Kill app, reopen — still signed in (session persisted)
- [ ] 8.6 Set `deactivated_at` on the servant row — next sign-in still succeeds (deactivation enforcement is phase 15's job — not blocking auth here, just verifying nothing crashes)
- [ ] 8.7 `openspec validate add-servant-auth` passes
