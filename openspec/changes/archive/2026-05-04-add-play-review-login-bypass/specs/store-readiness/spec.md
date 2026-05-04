## ADDED Requirements

### Requirement: A reviewer test account SHALL be provisioned and documented for App access submissions.

For every store-submission environment (production, and preview if used for review), the project MUST maintain:

- A configured `REVIEW_BYPASS_EMAIL` Supabase Edge Function secret with a non-guessable random local-part (8+ hex chars) under the `stminaconnect.app` domain.
- A matching `auth.users` row created via `auth.admin.createUser({ email, email_confirm: true })`.
- A matching `servants` row with the minimum role required to exercise reviewer-relevant flows (default: non-admin servant; escalate only if review explicitly tests admin features).
- A short, repeatable provisioning script under `scripts/` that performs the create-user + insert-servant-row steps idempotently.
- A documented entry in the store-readiness submission runbook recording the canonical bypass email and a one-line description of the reviewer's expected sign-in path ("type the email on the sign-in screen, tap the link in the dialog that appears").

The bypass email SHALL be the value entered into Google Play Console "App access" and Apple App Store Connect "Sign-in required" reviewer-credentials fields.

#### Scenario: Reviewer credentials are recorded in the runbook and match what the function expects

- **WHEN** an operator opens the store-readiness submission runbook
- **THEN** the runbook lists the canonical reviewer bypass email
- **AND** the value matches what `supabase secrets list` reports for `REVIEW_BYPASS_EMAIL` in the target environment
- **AND** the runbook references the provisioning script path and explains how to re-run it on a fresh environment

#### Scenario: Submission to Play Console "App access" uses the documented credentials

- **WHEN** an operator fills in Google Play Console "App access" → "All functionality is available without restrictions" → reviewer test instructions
- **THEN** the supplied email matches the bypass email recorded in the runbook
- **AND** the supplied instructions describe the dialog-based sign-in (no email link tap, no SMS, no second account)
- **AND** a smoke test on a clean device or emulator with that email completes sign-in successfully end-to-end
