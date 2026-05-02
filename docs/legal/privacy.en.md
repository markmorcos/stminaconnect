version: 2026-04-28

# Privacy Policy — St. Mina Connect

## 1. Data Controller

St. Mina Coptic Orthodox Church
Munich, Germany
Email: privacy@stminaconnect.com

A postal address for the parish is provided on request and will be added to this Policy before public release.

## 2. Privacy contact

Privacy questions, rights requests and complaints can be sent to **privacy@stminaconnect.com**.

The parish has not formally designated a Data Protection Officer under Art. 37 GDPR / §38 BDSG, because the threshold conditions (large-scale or core-activity processing of special categories) are not met for this small internal app. The address above is the parish's privacy contact and reaches the volunteer responsible for data protection.

## 3. What this app is

St. Mina Connect helps the church's volunteers ("servants") register newcomers, track attendance against church events, detect pastoral risk (extended absences), and coordinate follow-ups. **Members do not log in.** Only servants and church admins use the app.

## 4. Categories of data subjects

- **Servants** (volunteers) and clergy who authenticate to use the app.
- **Members** of the parish and newcomers known to the parish, whose pastoral data is entered into the app by servants. Members do not interact with the app directly.

## 5. Personal data we process

| Category            | Examples                                 | Source                                                                    | Stored where                     |
| ------------------- | ---------------------------------------- | ------------------------------------------------------------------------- | -------------------------------- |
| Servant identity    | Email, display name, role                | Provided at sign-up by the servant                                        | Supabase Auth (EU/Frankfurt)     |
| Member contact info | First/last name, phone, region, language | Entered by a servant during registration; supplied verbally by the member | Supabase Postgres (EU/Frankfurt) |
| Pastoral notes      | Free-text comments on a member           | Entered by the assigned servant                                           | Supabase Postgres (EU/Frankfurt) |
| Attendance          | Which member attended which church event | Entered by servants on the check-in screen                                | Supabase Postgres (EU/Frankfurt) |
| Follow-ups          | Pastoral actions logged against a member | Entered by servants                                                       | Supabase Postgres (EU/Frankfurt) |
| Operational logs    | Crash reports, error logs (no analytics) | Supabase platform logs                                                    | Supabase, retained ≤30 days      |

The app does not store special-category data (religious belief, health, ethnicity, etc.) as data fields. See section 7 for the nuance regarding implicit religious affiliation.

## 6. Source of member data (Art. 14 GDPR)

Member data is collected from the member at the time the servant registers them — typically in person at a church event — and from the assigned servant's pastoral observations. Members are informed verbally at registration that their contact details will be recorded by the parish for pastoral follow-up, and they can object at any time (see section 11).

## 7. Lawful basis (Art. 6 and Art. 9 GDPR)

### Servant data

- **Art. 6(1)(b) GDPR** — performance of the volunteer agreement between the parish and the servant. Where Art. 6(1)(b) is considered narrow for unpaid volunteers, the parish additionally relies on **Art. 6(1)(f)** (legitimate interest of the parish in coordinating its volunteer team). Personnel-style data of servants is processed analogous to **§26 BDSG** principles.

### Member data

- **Art. 6(1)(f) GDPR** — legitimate interest of the parish in providing pastoral care to its community (registering newcomers, recognising extended absences, organising follow-ups). The processing is limited to the minimum data necessary for that purpose, the data is not shared outside the volunteer team, and members can object at any time. The parish has documented the balancing test internally and concluded that members' interests are not overridden, given the limited scope, the in-EU hosting, the strict access controls (RLS, role-based access), and the absence of any tracking, profiling, or third-party sharing.

### Special-category data (Art. 9 GDPR)

The app does **not** process the religious belief of members as a data field. However, the very fact that a person appears in a parish's pastoral system can imply a relationship with the Coptic Orthodox Church. Where this implicit signal is treated as special-category data, the parish relies on:

- **Art. 9(2)(d) GDPR** — processing carried out in the course of the legitimate activities of a not-for-profit body with a religious aim, with appropriate safeguards, on members and persons in regular contact with the parish in connection with its purposes, and the data is not disclosed outside the parish without consent.

The parish is a Coptic Orthodox community in Germany. It does not operate under its own ecclesiastical data-protection regime (such as DSG-EKD for Protestant churches or KDG for the Roman Catholic Church); the GDPR and the BDSG apply directly.

## 8. Purposes

- Coordinate pastoral care: registering newcomers, tracking attendance against church events, detecting extended absences, organising follow-ups.
- No marketing, no advertising, no analytics, no profiling, **no automated decision-making with legal or similarly significant effect** (Art. 22 GDPR).

## 9. Recipients and subprocessors

Personal data is **not** shared with third parties for tracking, advertising, or analytics. Operational subprocessors:

- **Supabase, Inc.** — database, authentication, edge functions; data hosted in EU/Frankfurt. Data Processing Agreement on file (see `docs/legal/dpa.md`).
- **Google LLC (Google Calendar API)** — used solely to **read** the parish's published event calendar. **No personal data of members or servants is sent to Google.** Only the calendar's own event metadata (titles, times) is read by the server-side integration.

Within the parish, member data is accessible to the assigned servant and admins (clergy) only. Pastoral notes (`comments`) are restricted to the assigned servant and admins by Row-Level Security.

## 10. International transfers

Personal data is stored in the EU (Frankfurt region). **No transfers of personal data outside the EU/EEA take place.** The Google Calendar integration is read-only and does not transmit personal data of members or servants to Google's infrastructure.

## 11. Retention

| Data                                  | Retention                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| Active servant rows                   | While the servant has an account                                                |
| Members marked active                 | While the parish wishes to track them; admin reviews inactive members > 2 years |
| Soft-deleted members                  | PII scrubbed immediately; row retained for referential integrity                |
| Hard-erased members (Art. 17 request) | Removed entirely; attendance anonymised                                         |
| Consent log                           | Indefinite, append-only (history of acceptances)                                |
| Audit log entries                     | 5 years                                                                         |
| Notifications                         | 1 year                                                                          |
| Operational logs (Supabase platform)  | ≤ 30 days                                                                       |

These durations are reflected in `docs/legal/retention.md` and enforced as described there.

## 12. Your rights (Art. 15–22 GDPR)

You have the right to:

- **Access** (Art. 15) — Settings → Privacy → "Download my data" delivers a JSON copy. For members, contact privacy@stminaconnect.com.
- **Rectification** (Art. 16) — your assigned servant can correct your record; servants edit their own account in Settings.
- **Erasure** (Art. 17, "right to be forgotten") — Settings → Privacy → "Delete my account" for servants. For members, contact the parish; an admin will perform a hard-erasure that removes the personal record entirely and anonymises related attendance rows.
- **Restriction of processing** (Art. 18) — request via privacy@stminaconnect.com. Handled by the parish admin.
- **Data portability** (Art. 20) — the JSON export above is in a machine-readable format suitable for portability where applicable.
- **Object** (Art. 21) — for processing based on Art. 6(1)(f), at any time, by emailing privacy@stminaconnect.com. The parish will stop processing unless it can demonstrate compelling legitimate grounds, and in any case will respect an objection by a member to the use of their data for pastoral follow-up.
- **Withdraw consent** — where any processing is based on consent (e.g. acceptance of this Policy as a condition of using the app), you can withdraw at any time; withdrawal does not affect prior lawful processing.
- **Not be subject to solely automated decisions** (Art. 22) — none take place in this app.

Requests are answered within one month (Art. 12(3) GDPR), free of charge for the first request.

### Right to lodge a complaint (Art. 77 GDPR)

You may lodge a complaint with the competent supervisory authority. For the parish in Munich, the competent authority is:

**Bayerisches Landesamt für Datenschutzaufsicht (BayLDA)**
Promenade 18
91522 Ansbach, Germany
https://www.lda.bayern.de/

You may also contact the supervisory authority of your habitual residence or place of work.

## 13. Children

The parish is a community organisation; children of community members may be registered by their parents or by a servant with parental knowledge, and may be the subject of pastoral follow-up. Where a member is a minor, the parish relies on parental knowledge and the same legitimate-interest basis (Art. 6(1)(f)) read together with Art. 8 GDPR principles for any processing that requires consent. The app does not knowingly collect data from children directly: members do not log in, and any data about a minor is entered by an adult servant on their behalf. Parents or guardians can request access, correction, or erasure of a minor's record at any time via privacy@stminaconnect.com.

## 14. No tracking

This app performs **no analytics, no third-party trackers, no advertising, and no telemetry** beyond operational error logs that are kept by Supabase for ≤30 days and are not used for tracking or profiling. No advertising or analytics SDKs are linked into the app. The iOS App Privacy nutrition label declares "Used for tracking: No" for every category.

## 15. Security (Art. 32 GDPR)

Technical and organisational measures include:

- All data encrypted at rest by Supabase (AES-256).
- All client-server traffic encrypted in transit (HTTPS/TLS).
- Row-Level Security enforced server-side; the `comments` field on a member is readable only by the assigned servant and admins.
- All client database access goes through RPC functions with explicit authorisation checks.
- Authentication tokens stored in OS-secure storage on the device (iOS Keychain / Android EncryptedSharedPreferences).
- Data minimisation: only fields required for pastoral coordination are collected; no photos in v1.
- Role-based access: members are visible only to the assigned servant and admins; admins are clergy / church leadership.
- Audit log of sensitive actions (erasure, role changes, data exports, consent events).
- Servants are bound by a confidentiality undertaking via the Terms of Service.

## 16. Changes to this Policy

We log the version of this Policy that you accepted. When the Policy is updated, you will be asked to review and re-accept on next sign-in. Past versions are available on request.

## 17. Contact

privacy@stminaconnect.com
