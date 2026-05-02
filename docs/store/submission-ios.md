# iOS Submission — Stepwise Playbook

Audience: a developer with no prior App Store submission experience. Follow top-to-bottom; do not skip steps.

Pre-requisites:

- A production EAS build is available (i.e. `eas build -p ios --profile production` has succeeded).
- `eas.json` has `submit.production.ios` populated (see `eas.json`).
- `docs/store/listings/en.md` (and `ar.md`, `de.md` if shipping multi-locale on day one) are reviewed and approved (`docs/store/listings/_review.md`).
- Framed screenshots exist under `assets/store/screenshots-framed/ios/{en,ar,de}/` — at least 3 per locale.
- `docs/store/age-rating.md` and `docs/store/ios-privacy-label-final.md` are filled in.

## 1. Apple Developer Program enrolment

1. Go to <https://developer.apple.com/programs/enroll/>.
2. Sign in with the Apple ID intended for the developer account.
3. Pay the annual fee (USD 99 for individual; USD 299 for organization). For solo, individual is sufficient.
4. Wait for confirmation email (typically same-day, occasionally 24–48h).
5. Once approved, note the **Apple Team ID** (Apple Developer → Membership). Paste it into `eas.json` → `submit.production.ios.appleTeamId`.

## 2. Create the App Store Connect record

1. Go to <https://appstoreconnect.apple.com/apps>.
2. Click **+** → **New App**.
3. Fill in:
   - **Platforms**: iOS.
   - **Name**: `St. Mina Connect` (this is the public name; can be edited per locale later).
   - **Primary language**: English (U.S.).
   - **Bundle ID**: pick `com.stminaconnect` from the dropdown. If it does not appear, register it first under <https://developer.apple.com/account/resources/identifiers/list>.
   - **SKU**: `stminaconnect-001` (any unique internal ID).
   - **User Access**: Full Access.
4. Click Create. The new app record opens.
5. Copy the **App Store Connect App ID** (the numeric ID shown in the URL after `/apps/`). Paste into `eas.json` → `submit.production.ios.ascAppId`.
6. Copy the **Apple ID (account email)**. Paste into `eas.json` → `submit.production.ios.appleId`.

## 3. Localize the app record

For each locale to ship (EN, AR, DE):

1. Click **App Information** → **Localizable Information** → **+** → pick the locale.
2. Paste the locale's content from `docs/store/listings/<locale>.md`:
   - **Name** → ASC "Name"
   - **Subtitle** → ASC "Subtitle"
   - **Promotional text** (optional) → ASC "Promotional Text"
   - **Description** (full) → ASC "Description"
   - **Keywords** → ASC "Keywords"
   - **Support URL** → `https://stminaconnect.com` (or `mailto:support@stminaconnect.com`)
   - **Marketing URL** → `https://stminaconnect.com`
3. Save.

Arabic note: the AR locale must be enabled at the App Store Connect project level first (App Information → Localizable Information → "+ Arabic"). One-time setup.

## 4. Upload screenshots

For each locale tab, on the version page (default 1.0.0):

1. Scroll to **App Previews and Screenshots**.
2. Choose **6.7" iPhone Display**.
3. Drag-and-drop the three framed PNGs from `assets/store/screenshots-framed/ios/<locale>/` in numerical order (`01-quick-add.png`, `02-check-in.png`, `03-dashboard.png`).
4. Save.

Apple's required screenshot size: **1290 × 2796** for iPhone 6.7" — the dev-client capture instructions in `docs/store/screenshots.md` produce this size.

## 5. Fill the App Privacy nutrition label

Follow `docs/store/ios-privacy-label-final.md` exactly. The submission UI flow is:

1. App Privacy → **Edit** → "Get Started".
2. Tracking question: **"No, we do not use data for tracking purposes"**.
3. Add data types per the matrix in the privacy-label-final doc.
4. Privacy Policy URL: `https://stminaconnect.com/privacy`.
5. Save & Publish.

## 6. Age rating

1. Age Rating → **Edit**.
2. Answer every question per `docs/store/age-rating.md` § Apple App Store. All answers are **None** / **No**.
3. Save. Resulting rating: 4+.

## 7. Pricing & availability

1. Pricing and Availability → **Price**: Free.
2. **Availability**: Germany only (uncheck "Available in all territories", then check Germany only). Other countries can be added later by amending this list.
3. Save.

## 8. App Review Information

1. Version → scroll to **App Review Information**.
2. **First name / Last name / Phone / Email**: developer's contact details.
3. **Notes**: paste:

   ```
   St. Mina Connect is a pastoral-care companion for Coptic Orthodox parishes in Germany. The app is used by volunteer church servants to register parish members, mark attendance at services, and follow up with members who have not been seen recently. Members do not log in; only servants and admins do.

   To test the app, please use:
     Email:    review@stminaconnect.com    (set this up via Test User instructions below)
     Password: <single-use review password — generate one before submission>

   The icon contains a Coptic cross as a brand identity mark; this is documented in our submission notes (docs/store/age-rating.md). The app contains no proselytizing content.
   ```

4. **Demo Account** (sign-in required): provide the credentials above. Generate via Supabase Auth in the production project; mark as a magic-link account with a known temporary OTP. See `docs/store/review-account.md` (TODO before submission).

## 9. Build upload via `eas submit`

```bash
eas submit -p ios --profile production --latest
```

Use `--latest` if you've already built; otherwise build first:

```bash
eas build -p ios --profile production
eas submit -p ios --profile production --latest
```

Monitor the upload: it pushes the IPA to App Store Connect, where it appears as a "Processing" build under TestFlight. Processing takes 5–60 minutes.

Once processing completes, attach the build to the version:

1. Version → **Build** → **+** → select the just-uploaded build.
2. Save.

## 10. Submit for review

1. Click **Add for Review** at the top of the version page.
2. Answer the export-compliance question:
   - "Does your app use encryption?" → **No** (we have `ITSAppUsesNonExemptEncryption: false` in `app.json`, but the form re-asks — answer No).
3. Click **Submit for Review**.
4. The status moves to "Waiting for Review" → typically 24–48h → "In Review" → "Pending Developer Release" or "Ready for Sale".

## 11. Post-approval release

If the submission is set to **Manual release** (recommended for first launch):

1. After approval, click **Release this Version**.
2. Status moves to "Pending Apple Release" → typically <2h → "Ready for Sale".
3. Verify on the App Store (`https://apps.apple.com/de/app/<app-name>/id<ascAppId>`) within 4 hours.

## 12. If review is rejected

1. Read the rejection message in App Store Connect → Resolution Center.
2. Common rejections for this app:
   - **Guideline 1.1.6 (objectionable content)** — reply per `docs/store/age-rating.md` § Religious iconography rationale.
   - **Guideline 5.1.1 (data collection)** — verify Privacy nutrition label matches actual collection; Privacy Policy URL must be reachable.
   - **Guideline 2.1 (app completeness)** — provide a working demo account; verify `eas submit` uploaded the production build, not preview.
3. Reply via Resolution Center; do not click "Reject Binary" unless re-submitting a new build.
4. Apple reviews the response within 24–48h.
