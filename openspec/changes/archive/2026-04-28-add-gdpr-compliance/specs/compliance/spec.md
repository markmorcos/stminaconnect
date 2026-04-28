# compliance — Spec Delta

## ADDED Requirements

### Requirement: First-launch SHALL gate authenticated access on consent acceptance.

After a successful Supabase sign-in, the app MUST check `get_my_latest_consent()`. If no acceptance row exists, OR the latest accepted versions do not equal the currently-published policy and terms versions, the user MUST be navigated to the onboarding consent screen and SHALL NOT see any other authenticated route until acceptance is recorded.

#### Scenario: First-time user prompted

- **GIVEN** a new servant signs in for the first time
- **WHEN** the auth check completes
- **THEN** the user is navigated to the onboarding consent screen
- **AND** no home screen content has rendered

#### Scenario: Returning user with current consent

- **GIVEN** a servant whose most recent consent matches both the current Privacy and Terms versions
- **WHEN** the user signs in
- **THEN** they are navigated to the home/dashboard directly
- **AND** the consent screen is not shown

#### Scenario: Returning user with outdated consent

- **GIVEN** a servant who accepted a prior policy version
- **AND** the published policy has been updated to a newer version
- **WHEN** the user signs in
- **THEN** the consent screen is shown again with the new content

#### Scenario: Decline returns to sign-in

- **WHEN** the user taps Decline on the consent screen
- **THEN** the auth store calls `signOut`
- **AND** no consent row is recorded
- **AND** the user is shown the sign-in screen

### Requirement: Consent acceptances SHALL be logged with timestamp and version.

Each tap of "Accept and continue" MUST insert a row into `consent_log` with the `policy_version`, `terms_version`, and `accepted_at = now()` for the calling `auth.uid()`. The row MUST be retained even if the user later revokes; revocation sets `revoked_at` rather than deleting.

#### Scenario: Acceptance row recorded

- **WHEN** a user accepts the consent screen
- **THEN** exactly one new row exists in `consent_log` with the user's id, the active versions, and a recent `accepted_at`
- **AND** `revoked_at` is null

### Requirement: Servants SHALL be able to export their own data.

A Settings → Privacy → "Download my data" action MUST call `export_my_data()`, receive a JSON envelope of all records associated with the caller, and offer it via the OS share sheet (`expo-sharing.shareAsync`).

#### Scenario: Self-export succeeds

- **GIVEN** a signed-in servant
- **WHEN** the user taps "Download my data"
- **THEN** the JSON returned by the RPC contains: their `auth.users` summary, their `servants` row, their `notifications`, their `consent_log` rows, and the `follow_ups` they created
- **AND** the OS share sheet opens with a `.json` attachment named `stmina-connect-my-data-{date}.json`

### Requirement: Admins SHALL be able to export a person's full data.

The Admin Compliance screen MUST allow searching for a person and exporting their full data via `export_person_data(person_id)`. The function returns a 24-hour signed URL to a JSON file in Supabase Storage. Both the action and the returned URL MUST be recorded in `audit_log`.

#### Scenario: Admin export logs and returns URL

- **GIVEN** admin A on the Compliance screen
- **WHEN** A searches for person P and taps Export
- **THEN** `export_person_data(P.id)` returns a signed URL valid for 24 hours
- **AND** an `audit_log` row exists with `actor_id=A.id`, `action='data.export'`, `target_type='person'`, `target_id=P.id`

### Requirement: Servants SHALL be able to erase their own account.

Settings → Privacy → "Delete my account" MUST open a typed-confirmation dialog requiring the servant to type their full name to enable the Confirm button. On confirm, `erase_my_account()` MUST anonymize all records that reference the servant via the sentinel id `00000000-0000-0000-0000-000000000000`, delete the `servants` row, delete the `auth.users` row via Edge Function, and audit-log the action.

#### Scenario: Self-erasure removes auth user

- **GIVEN** servant S signed in
- **WHEN** S confirms self-deletion
- **THEN** the `servants` row for S is gone
- **AND** the `auth.users` row for S is gone
- **AND** records previously referencing S (e.g. `attendance.marked_by`, `follow_ups.created_by`) now reference the sentinel id
- **AND** an `audit_log` row exists with `actor_id` (still S, recorded just before deletion), `action='servant.self_erase'`
- **WHEN** S attempts to sign back in with the same email
- **THEN** the sign-in fails

### Requirement: Admins SHALL be able to perform GDPR Article 17 hard-erasure of a member.

The Admin Compliance screen MUST present a per-person Erase action gated by:

- A typed-confirmation requiring the admin to type the person's full name exactly.
- A free-text Reason input of at least 20 characters.

`erase_person_data(person_id, reason)` MUST:

- Delete the `persons` row entirely.
- Set `attendance.person_id = NULL` and `attendance.was_anonymized = true` for every attendance row referencing the person.
- Delete `follow_ups` for the person.
- Delete `notifications` referencing the person via `payload->>'personId'` matches.
- Insert an `audit_log` row capturing actor, action, target, reason, and a count of affected attendance rows.

The erasure MUST be irreversible.

#### Scenario: Hard-erasure preserves anonymized attendance

- **GIVEN** person P with 12 attendance rows, 3 follow_ups, 1 notification
- **WHEN** an admin erases P with reason "GDPR Article 17 request 2026-04-25"
- **THEN** the `persons` row for P is gone
- **AND** 12 `attendance` rows have `person_id=NULL` and `was_anonymized=true`
- **AND** the 3 `follow_ups` are gone
- **AND** the 1 `notification` is gone
- **AND** an `audit_log` row records the action with `payload->>'attendance_anonymized_count'='12'`

#### Scenario: Erase requires typed confirmation and reason

- **GIVEN** the erase dialog is open for "Mariam Saad"
- **WHEN** the admin types "Mariam" only (incomplete) AND a reason of 30 chars
- **THEN** the Confirm button remains disabled

- **WHEN** the admin types "Mariam Saad" exactly AND a reason of 5 chars
- **THEN** the Confirm button remains disabled

- **WHEN** both conditions are satisfied
- **THEN** the Confirm button is enabled

### Requirement: An audit log SHALL record sensitive actions and be admin-readable.

The `audit_log` table MUST be appended-to whenever:

- a member is soft-deleted, hard-erased, or reassigned;
- a servant's role is changed, deactivated, reactivated, invited, or self-erased;
- a data export is performed (admin or self);
- consent is accepted or revoked;
- an absence-detection or notification dispatch occurs.

Reads MUST be admin-only. Writes MUST go through `record_audit` (SECURITY DEFINER) — direct INSERTs from clients are denied.

#### Scenario: Non-admin cannot read audit log

- **GIVEN** a non-admin servant
- **WHEN** the client queries `audit_log`
- **THEN** the result is empty (RLS-filtered)

#### Scenario: Multiple actions produce multiple rows

- **GIVEN** an admin performs three sensitive actions in sequence
- **THEN** `audit_log` contains three rows, each with the corresponding `action` value, in chronological order

### Requirement: Privacy Policy and Terms SHALL be accessible in-app from settings.

The Settings → Privacy screen MUST navigate to in-app reader screens (`app/(app)/legal/privacy.tsx` and `app/(app)/legal/terms.tsx`) that render the bundled markdown for the active language. The documents are compiled into the JS bundle at build time; no live URL is fetched and no external browser is opened.

#### Scenario: Tapping View Privacy Policy

- **WHEN** the user taps "View Privacy Policy" in Settings → Privacy
- **THEN** the app pushes `/legal/privacy`
- **AND** the bundled Privacy Policy renders as scrollable formatted content
- **AND** no network request is made

#### Scenario: Tapping View Terms

- **WHEN** the user taps "View Terms" in Settings → Privacy
- **THEN** the app pushes `/legal/terms`
- **AND** the bundled Terms of Service render as scrollable formatted content

### Requirement: Privacy and Terms documents SHALL be available in EN, AR, and DE.

The bundled documents MUST exist in EN, AR, and DE. When a user views a document or sees the consent screen, the version matching `i18n.language` MUST be displayed; if absent, the EN version is the fallback.

#### Scenario: Arabic user gets Arabic policy

- **GIVEN** active language is `ar`
- **WHEN** the user opens Privacy Policy
- **THEN** the displayed content is the Arabic version

### Requirement: The app SHALL declare no analytics or tracking.

The Privacy Policy MUST explicitly state that the app performs no analytics, no third-party tracking, no advertising, and no telemetry beyond operational error logs. The iOS App Privacy nutrition label declaration MUST list "Used for tracking: No" for every category.

#### Scenario: Disclosure visible

- **WHEN** a reviewer opens the published Privacy Policy
- **THEN** a prominent paragraph explicitly disclaims analytics/tracking/ads
