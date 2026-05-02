# iOS App Privacy — Final Submission Matrix

This is the **submission-ready** version of the App Store Connect privacy nutrition label, locked from `add-gdpr-compliance` design § 12 and `docs/legal/ios-app-privacy.md`. Every category declares **Used for tracking: No**.

## Submission UI mapping

In App Store Connect → App Privacy, the matrix below maps directly to the form. Click "Edit" on each section, select the data types listed, then for each type select the purposes listed.

### 1. Data Used to Track You

> Click "Get Started" → answer **"No, we do not use data for tracking purposes"**.

Confirmation: the app contains no third-party analytics, advertising, or data-broker SDKs. The Privacy Policy (`docs/legal/privacy.en.md`, "No tracking" section) states this explicitly.

### 2. Data Linked to You

Click "Add Data Type" → select each of the following.

| Apple category | Apple sub-category | Selected purposes | Why we collect                                                                    |
| -------------- | ------------------ | ----------------- | --------------------------------------------------------------------------------- |
| Contact Info   | Name               | App Functionality | Servant identity for sign-in and audit                                            |
| Contact Info   | Email Address      | App Functionality | Servant identity (sign-in, account recovery)                                      |
| Contact Info   | Phone Number       | App Functionality | Member contact info for pastoral follow-up                                        |
| User Content   | Other User Content | App Functionality | Free-text pastoral notes on a member; visible only to assigned servant and admins |
| Identifiers    | User ID            | App Functionality | Supabase `auth.users.id` mapped to the servant's row                              |

For each row above, in the Apple form: **Linked to user = Yes**, **Used for tracking = No**.

### 3. Data Not Linked to You

Click "Add Data Type" → select:

| Apple category | Apple sub-category | Selected purposes | Why we collect                                               |
| -------------- | ------------------ | ----------------- | ------------------------------------------------------------ |
| Diagnostics    | Crash Data         | App Functionality | Operational error logs; ≤ 30-day retention via Supabase Logs |

For this row: **Linked to user = No**, **Used for tracking = No**.

### 4. Data Not Collected

The following Apple categories are explicitly **not** collected. If a reviewer asks, the answer is "we do not collect this":

- Health & Fitness
- Financial Info
- Location (precise or coarse)
- Sensitive Info
- Contacts (the device contacts list)
- Photos / Videos / Audio / Customer Support
- Search History / Browsing History / Other Identifiers
- Purchases / Payment Info / Credit Info
- Gameplay Content / Other Diagnostic Data

## Submission checklist

- [ ] Open App Store Connect → My Apps → St. Mina Connect → App Privacy.
- [ ] Click "Get Started" under "Data Types" if not already initialized.
- [ ] Tracking: select "No, we do not use data for tracking purposes."
- [ ] For each row in §2 above: click "Add Data Type" → select the Apple category + sub-category → choose "Yes, data is linked to user" → select **App Functionality** as the purpose → save.
- [ ] For the §3 row: same flow but choose "No, data is not linked to user" + **App Functionality**.
- [ ] Privacy Policy URL: `https://stminaconnect.com/privacy`.
- [ ] Save & Publish.
- [ ] Capture a PDF/screenshot of the published label and store it under `docs/store/audit/ios-privacy-label-published.pdf` for compliance audit.
