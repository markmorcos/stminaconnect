# Android (Google Play) Submission — Stepwise Playbook

Audience: a developer with no prior Play submission experience. Follow top-to-bottom.

Pre-requisites:

- A production EAS build (`eas build -p android --profile production`) has produced an `.aab`.
- `eas.json` has `submit.production.android` populated.
- `secrets/play-service-account.json` exists locally and is uploaded as the EAS secret `PLAY_SERVICE_ACCOUNT` (see `secrets/README.md`).
- `docs/store/listings/<locale>.md` reviewed and approved (`docs/store/listings/_review.md`).
- Framed screenshots exist under `assets/store/screenshots-framed/android/{en,ar,de}/` — at least 3 per locale.

## 1. Create the Google Play developer account

1. Go to <https://play.google.com/console/signup>.
2. Pay the one-time USD 25 fee.
3. Complete identity verification (Google now requires personal ID for individual accounts; allow 24–48h for verification).
4. Once approved, you can create your first app.

## 2. Create the Play Console app record

1. Play Console → All apps → **Create app**.
2. Fill in:
   - **App name**: `St. Mina Connect`.
   - **Default language**: English (United States).
   - **App or game**: App.
   - **Free or paid**: Free.
   - Tick the policies: developer programs, US export laws.
3. Click **Create app**.

## 3. Provision the service account for `eas submit`

1. Play Console → **Setup → API access** → **Choose a project to link**: pick your Google Cloud project (or create one).
2. Click **Create service account** → opens Google Cloud Console.
3. In Cloud Console: **+ Create Service Account** → name it `eas-submit` → Role: none (Play Console grants permissions, not GCP) → Done.
4. Open the new service account → **Keys → Add Key → Create new key → JSON**. Download the file.
5. Move the file to `secrets/play-service-account.json` (gitignored).
6. Back in Play Console → **API access** → find the service account → click **Grant access** → assign **Release manager** role for this app → save.
7. Upload it to EAS:
   ```bash
   eas secret:create --scope project --name PLAY_SERVICE_ACCOUNT --type file --value ./secrets/play-service-account.json
   ```

## 4. Fill the store listing

Play Console → app → **Grow → Store presence → Main store listing**.

For each locale (EN/AR/DE):

1. Click **Manage translations → Add your own translation** → pick the locale.
2. Paste from `docs/store/listings/<locale>.md`:
   - **App name** → "App name"
   - **Short description** → "Short description"
   - **Full description** → "Full description"
3. Upload assets:
   - **App icon**: 512 × 512 PNG (export from `assets/branding/icon-source.png` — see `docs/branding.md`).
   - **Feature graphic**: 1024 × 500 PNG. Create one from `assets/branding/` (deferred to a follow-up if not yet produced — Play accepts solid-colored placeholders).
   - **Phone screenshots**: drag the framed PNGs from `assets/store/screenshots-framed/android/<locale>/` (minimum 2, max 8; we provide 3).
4. **Save**.

## 5. Content rating

1. Play Console → app → **Policy → App content → Content ratings → Start questionnaire**.
2. Email: developer's email.
3. Category: **Reference, News, or Educational** (closest match for a community/utility app).
4. Answer every question per `docs/store/age-rating.md` § Google Play. All answers are **No**.
5. Submit. Result: **Everyone**.

## 6. Data safety form

The Data Safety form mirrors the iOS Privacy nutrition label — same data types, same purposes. Source of truth: `docs/store/ios-privacy-label-final.md`.

1. Play Console → app → **Policy → App content → Data safety → Start**.
2. **Did you collect or share any user data?** → Yes.
3. **Is all the user data collected by your app encrypted in transit?** → Yes (Supabase HTTPS).
4. **Do you provide a way for users to request that their data is deleted?** → Yes (in-app Settings → Privacy → "Delete my account"; documented in privacy policy).
5. **Data types** — for each, declare collected/shared and purpose:

| Data type          | Collected | Shared | Purpose                                         | Optional?                 |
| ------------------ | --------- | ------ | ----------------------------------------------- | ------------------------- |
| Name               | Yes       | No     | App functionality                               | Required                  |
| Email address      | Yes       | No     | App functionality                               | Required (servants only)  |
| Phone number       | Yes       | No     | App functionality                               | Optional                  |
| User IDs           | Yes       | No     | App functionality                               | Required                  |
| Other user content | Yes       | No     | App functionality                               | Optional (pastoral notes) |
| Crash logs         | Yes       | No     | App functionality, Analytics (operational only) | n/a                       |

For every other data type Play offers, choose **No, this data is not collected or shared**.

6. **Submit**.

## 7. Pricing & distribution

1. **Pricing**: Free (already set at app creation).
2. Play Console → **Production → Countries / regions** → **Add countries / regions** → select **Germany** only (start tight; expand later).
3. Save.

## 8. Internal testing release (recommended first)

1. Play Console → **Testing → Internal testing → Create new release**.
2. Click **Upload** → drag the `.aab` from the latest production build (or use `eas submit -p android --profile production --track internal`).
   ```bash
   eas submit -p android --profile production --latest
   ```
3. Add internal testers (email list under "Testers" tab).
4. Click **Save → Review release → Start rollout**.
5. Internal testers receive the link within 5 minutes.

## 9. Production rollout

After internal testing has validated the build:

1. Play Console → **Production → Create new release**.
2. **Promote release from internal testing** → pick the build.
3. Add release notes ("Initial release.").
4. **Save → Review release → Start rollout to Production**.
5. Choose **Staged rollout = 100%** (or start at 20% if cautious).
6. Status: Pending review → typically 1–7 days → **Live**.

## 10. Verification

After the app shows as Live:

1. Visit `https://play.google.com/store/apps/details?id=com.stminaconnect` (use a phone in Germany or VPN to Germany).
2. Confirm: name, screenshots, description, data safety section render correctly.
3. Install on a clean device, run through sign-in → consent → first screen.

## 11. If the submission is rejected

1. Play Console → app → **Policy → Policy status** → read the rejection.
2. Common rejections for this app:
   - **Data safety mismatch**: re-check that the data-safety declaration matches what the app actually collects. Update `docs/store/ios-privacy-label-final.md` and the Play form together.
   - **Content rating mismatch**: re-run the IARC questionnaire if a category was answered ambiguously.
   - **Sensitive permissions**: we request none beyond the standard React Native + push notifications. If flagged, document the use in `app.json`.
3. Submit a corrected release; Play re-reviews within 1–7 days.
