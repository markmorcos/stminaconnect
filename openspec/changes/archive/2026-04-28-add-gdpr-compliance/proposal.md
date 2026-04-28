## Why

GDPR is non-negotiable for EU-resident users — and the German Federal Data Protection Act (BDSG) adds local specifics. Without these in place, the app cannot legally onboard a single real user, even for internal pilot. We schedule this **before** `switch-to-development-build` so that the first users to install a build (testers via TestFlight or APK) encounter a compliant onboarding flow.

## What Changes

- **ADDED** capability `compliance`.
- **ADDED** Privacy Policy and Terms of Service hosted as static pages on `https://stmina.de/privacy` and `https://stmina.de/terms`, drafted in EN/AR/DE. Source markdown lives under `docs/legal/`.
- **ADDED** Consent flow on first launch:
  - Before any authenticated screen is reachable, the app SHALL show a one-time consent screen presenting Privacy Policy + Terms with explicit "Accept and continue" / "Decline" actions.
  - Acceptance is logged with timestamp + accepted version.
  - Decline returns the user to a blocking screen with re-prompt only.
- **ADDED** `consent_log` table:
  - `id`, `user_id` (auth.users), `policy_version`, `terms_version`, `accepted_at`, `revoked_at`.
  - One row per acceptance event (history preserved).
- **ADDED** Data export (Article 15 — Right to Access):
  - Admin-initiated: `export_person_data(person_id)` — returns a complete JSON of the person's row + all related rows (attendance, follow-ups, assignment_history). Downloaded via a temporary signed URL.
  - Servant self-export: `export_my_data()` — returns the requesting servant's auth.users + servants + notifications + follow-ups they created.
- **ADDED** Right-to-Erasure (Article 17):
  - Admin-initiated hard-delete: `erase_person_data(person_id, reason)` — removes the `persons` row entirely; sets `attendance.person_id` to NULL with `attendance.was_anonymized = true`; deletes `follow_ups` for the person; deletes notifications referencing the person; logs to audit log.
  - Distinct from the soft-delete introduced in `add-person-data-model` — soft-delete is for general churn; hard-erasure is a legal-request path with a stronger confirmation gate.
  - Servant self-erasure: `erase_my_account()` — anonymizes records the servant created (sets `created_by` to a sentinel servant or null), deletes their `servants` row, blocks future sign-in.
- **ADDED** Audit log:
  - `audit_log` table: `id`, `actor_id`, `action`, `target_type`, `target_id`, `payload jsonb`, `created_at`.
  - Recorded for: member soft-delete, member hard-erase, role changes, data exports (admin and self), bulk actions, consent acceptance/revocation, sign-in failures (rate-limit signal — last N).
  - Admin-only read view.
- **ADDED** Settings → Privacy screen (`app/(app)/settings/privacy.tsx`):
  - Links to current Privacy Policy and Terms (in active language).
  - Servant self-export button (downloads JSON).
  - Servant self-delete button with typed-confirmation.
  - Consent history view.
- **ADDED** Admin Compliance screen (`app/(app)/admin/compliance.tsx`):
  - Per-person export and erasure actions.
  - Audit log viewer (filterable by actor, action, date).
- **ADDED** Data retention policy:
  - Documented in `docs/legal/retention.md`.
  - Default: members marked `inactive` for >2 years are eligible for soft-delete (admin-prompted, not automatic in v1).
  - Audit log retention: 5 years (admin-only viewable).
  - Notifications older than 1 year auto-deleted.
- **ADDED** Cookie/tracking disclosure: documented in Privacy Policy that the app performs no analytics, no third-party tracking, no advertising.
- **ADDED** Supabase Data Processing Agreement: confirmed (project on EU/Frankfurt, DPA acknowledged via Supabase dashboard); documented in `docs/legal/dpa.md`.
- **ADDED** iOS App Privacy nutrition label content drafted (will be submitted in `prepare-store-listings`):
  - Data collected: contact info (email, name, phone) and church-related metadata.
  - Linked to user identity: yes (servant-only — members do not log in).
  - Used for tracking: no.
- **MODIFIED** `add-servant-auth` flow: post-auth, before any authenticated route is rendered, the consent screen blocks if no current acceptance exists.
- **MODIFIED** `add-person-data-model` is amended in this change to add `attendance.was_anonymized` column for use during hard-erasure.

## Impact

- **Affected specs**: `compliance` (new), `auth` (modified — adds consent gate), `person-management` (modified — adds hard-erasure and `was_anonymized` column).
- **Affected code**: new migrations `029_consent_log.sql`, `030_audit_log.sql`, `031_attendance_anonymized.sql`, `032_compliance_rpcs.sql`. New screens `app/(app)/onboarding/consent.tsx`, `app/(app)/settings/privacy.tsx`, `app/(app)/admin/compliance.tsx`. New `src/services/api/compliance.ts`. New `docs/legal/`.
- **Breaking changes**: existing test users will hit the consent flow on next sign-in. Documented.
- **Migration needs**: four migrations.
- **Expo Go compatible**: yes — pure data + UI flow.
- **Uses design system**: yes — all new screens consume design system tokens and components.
- **Dependencies**: `harden-and-polish` (the consent screen leans on its polished empty/error/loading states), `add-admin-dashboard`, `add-i18n-foundation`. Lands before `switch-to-development-build`.
