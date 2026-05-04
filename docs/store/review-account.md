# Apple/Google Review Account

App Store Review and (occasionally) Play Console Review require working sign-in credentials. Members do not log in — only servants do — so the review account must be a **servant** account.

Magic-link auth (the only sign-in path on this app) is fundamentally incompatible with how reviewers operate: a reviewer runs the build on a clean test device with no inbox, no SMS, and no second-account setup, so they cannot click an email link. Supabase magic links are also single-use and expire (default 1 h), so a baked-in link in the listing dies long before review starts.

The fix: a **server-issued reviewer-bypass** that a stable in-app affordance triggers. The reviewer types a configured email; an Edge Function detects it and returns a freshly-minted magic link; the app surfaces the link in a dialog with a "Sign in" button. See `openspec/changes/add-play-review-login-bypass/` for the full design.

## Components

- **Edge Function**: `supabase/functions/review-login/index.ts`. Compares the typed email to the `REVIEW_BYPASS_EMAIL` Supabase secret server-side, calls `auth.admin.generateLink({ type: 'magiclink' })` on a match, returns `{ link }`. Returns `{ link: null }` for every other email — the response shape is identical so callers fall through to the normal `signInWithOtp`.
- **Auth store wiring**: `src/state/authStore.ts` `signInWithMagicLink` calls the function before `signInWithOtp`. On a non-null `link` it sets `reviewLink` state and stops. On any error it falls through, so a function outage degrades to today's behaviour for real users.
- **Sign-in UI**: `app/(auth)/sign-in.tsx` renders a dialog with the link and a "Sign in" button when `reviewLink` is set. Tap → `Linking.openURL` → Supabase verify → deeplink back to `stminaconnect://auth/callback` → existing fragment-based session handler.
- **Provisioned identity**: a real `auth.users` row + matching `servants` row for the bypass email, created once via `scripts/provision-review-user.mjs`.
- **Secret**: `REVIEW_BYPASS_EMAIL` lives in Supabase Edge Function secrets — never in `app.json`, `eas.json`, any `EXPO_PUBLIC_*` var, or the JS bundle.

## Canonical reviewer email

> **Action**: when first provisioning, generate a non-guessable local-part to defeat enumeration. Record the value in this file once (and only once); the same email then flows into Play Console / App Store Connect reviewer-instructions fields, the Edge Function secret, and the provisioned auth user.

```bash
printf 'playreview-%s@stminaconnect.app\n' $(openssl rand -hex 4)
```

| Environment | Canonical reviewer email          |
| ----------- | --------------------------------- |
| Production  | _record after first provisioning_ |
| Preview     | _optional; usually skipped_       |

## Provisioning workflow (one-time per environment)

You only need to run this once per environment. After that the reviewer's sign-in works indefinitely — every tap of the dialog mints a fresh, valid magic link automatically.

1. **Generate the bypass email** (above) and record it in the table.
2. **Set the Edge Function secret**:
   ```bash
   make supabase-secrets-set NAME=REVIEW_BYPASS_EMAIL VALUE=<email> PROJECT=prod
   # or directly:
   supabase secrets set REVIEW_BYPASS_EMAIL=<email> --project-ref <prod ref>
   ```
3. **Provision the auth user + servants row**:
   ```bash
   SUPABASE_URL=https://<prod ref>.supabase.co \
   SUPABASE_SERVICE_ROLE_KEY=<service role from supabase dashboard> \
     node scripts/provision-review-user.mjs --email <email>
   ```
   The script is idempotent — re-running on an already-provisioned project is a no-op.
4. **Wait for CI to deploy the Edge Function** (next push to `main` triggers `deploy-supabase.yml`), or deploy manually:
   ```bash
   make deploy-functions PROJECT=prod
   ```
5. **Smoke-test** on a fresh production-channel build: type the bypass email on the sign-in screen → confirm the dialog appears with a working link → tap "Sign in" → confirm the home screen renders.

## What the reviewer sees / does

> Open the app → enter the email **`<bypass email>`** → tap **Sign in** in the dialog that appears.

That's it. No email, no SMS, no second account. The dialog stays on-screen until tapped or dismissed; tapping opens the system browser, which redirects back into the app with a valid session.

## Rotation

Treat the bypass email like a password: rotate when leaked or after suspicious access patterns. Rotation is cheap:

1. Generate a new local-part.
2. Update the Edge Function secret (`supabase secrets set REVIEW_BYPASS_EMAIL=<new email>`).
3. Re-run `scripts/provision-review-user.mjs --email <new email>` to create the new auth user + servants row.
4. Optional: delete the old auth user via the Supabase dashboard.
5. Update Play Console / App Store Connect reviewer instructions to reference the new email.
6. Update the table above.

No app rebuild required — the email is server-side only.

## Seed data the reviewer should see

After signing in, the review account must show:

- A handful of registered persons (≥ 3) so the Servant Dashboard isn't empty.
- A recent attendance event so Check-in is meaningful.
- One absence alert / follow-up so the Follow-ups screen has content.

Source: the realistic seed at `supabase/seed.sql`. Apply to the production project before review submissions, or maintain a separate `review-seed.sql` if production data shouldn't be polluted.

## Security posture

- Email is non-guessable (8 hex chars random) → enumeration via repeated probes is computationally infeasible.
- Edge Function logs every issuance (timestamp, IP, user-agent) for audit; mismatches log only the IP.
- Reviewer account uses the **minimum role** needed (default: non-admin servant). Escalate to `admin` only if review explicitly tests admin-only screens.
- A graceful-degradation `try/catch` around the Edge Function invoke ensures real users can still sign in if the function is down.
