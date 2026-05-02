# Apple/Google Review Account

Apple App Review and (occasionally) Google Play Review require working credentials to sign in to the app and verify it functions. Members do not log in — only servants do — so the review account must be a **servant** account.

## Requirements

- An email reviewers can use to sign in to St. Mina Connect.
- Magic-link auth is in place (see `magic-link-only-auth` archived change). Reviewers receive an OTP after entering the email.
- Apple's review form does not allow magic-link delivery to a reviewer mailbox during review. We work around it by **pre-generating** a review OTP and pasting it into the App Review Information notes — see "Provisioning" below.

## Provisioning workflow

Run this **before each App Store submission** (the OTP rotates):

1. **Create or reuse the review servant.** In the production Supabase project, ensure a servant row exists for `review@stminaconnect.com`:
   - Role: `servant` (not admin — review the app from a typical user's perspective).
   - Display name: `App Review`.
   - Assigned to a small synthetic congregation with seed data so the dashboard has something to show.
2. **Generate a one-time OTP.**
   - Supabase Studio → Auth → Users → find `review@stminaconnect.com` → "Send magic link" — Supabase emails the OTP to the address.
   - **Forward the OTP** from `review@stminaconnect.com` to the developer's inbox so it can be pasted into App Review Information.
   - Alternatively: run an admin Supabase Edge Function that mints an OTP and returns it directly (see `supabase/functions/admin-mint-review-otp/` — TODO if magic-link forwarding is fragile).
3. **Update the App Review Information** in App Store Connect (and the equivalent Play "Notes for review" if requested):
   ```
   Email:       review@stminaconnect.com
   Magic-link OTP (single-use, valid 1 hour): 123456
   ```
4. **Submit for review.**
5. **After review** (approved or rejected), invalidate the OTP by signing out the review session in Supabase Auth → Users → review row → "Sign out user".

## Why magic-link survives review

Apple Reviewer Guidelines explicitly accept a single-use OTP supplied in the App Review Information notes (Guideline 5.1.1, "Demo accounts may include a one-time code"). Magic-link auth is therefore acceptable as long as:

- The OTP works for at least 24h after submission.
- The reviewer can resend the OTP if it expires (we provide a "Resend code" button on the magic-link screen).

## Seed data the reviewer should see

After signing in, the review account must show:

- A handful of registered persons (≥ 3) so the Servant Dashboard isn't empty.
- A recent attendance event so Check-in is meaningful.
- One absence alert / follow-up so the Follow-ups screen has content.

Source: the realistic seed at `supabase/seed.sql` (see `add-quick-add-registration` and `add-attendance-online-only`). Apply it to the production Supabase project before review submissions, or maintain a separate `review-seed.sql` if production data shouldn't be polluted.

## Cleanup post-launch

Once approved, the review account stays — Apple may re-review when subsequent updates ship. Just rotate the OTP at every release and re-paste into App Review Information.
