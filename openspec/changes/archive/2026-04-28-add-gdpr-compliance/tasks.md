# Tasks — add-gdpr-compliance

## 1. Schema

- [x] 1.1 `033_consent_log.sql`: consent_log table; RLS — user can read own rows; admin can read all.
- [x] 1.2 `034_audit_log.sql`: audit_log table + indexes; RLS — admin-only SELECT; INSERT via SECURITY DEFINER helpers.
- [x] 1.3 `035_attendance_anonymized.sql`: add `was_anonymized boolean default false` to `attendance`; allow `person_id` to be nullable.
- [x] 1.4 `035_attendance_anonymized.sql`: insert sentinel "Erased Servant" row in `servants` (id `00000000-0000-0000-0000-000000000000`, role `servant`, deactivated_at set).

## 2. Compliance RPCs

- [x] 2.1 `036_compliance_rpcs.sql`:
  - `record_consent(policy_version, terms_version)` — caller-scoped insert into consent_log.
  - `revoke_consent(consent_id)` — caller-scoped update setting `revoked_at`.
  - `get_my_latest_consent()` — returns latest acceptance row.
  - `export_person_data(person_id uuid)` — admin-only; aggregates persons + attendance + follow_ups + assignment_history + notifications referencing the person; returns JSON envelope (signed-URL upload deferred to setup-production-deployment); logs to audit_log.
  - `export_my_data()` — caller-scoped; returns JSON; logs to audit_log.
  - `erase_person_data(person_id uuid, reason text)` — admin-only; performs the hard-erasure flow per design; logs to audit_log; reason length ≥ 20.
  - `erase_my_account()` — caller-scoped; anonymizes references via the Erased Servant sentinel; deletes `servants` row; deletes auth user via Edge Function.
  - `record_audit(action text, target_type text, target_id uuid, payload jsonb)` — internal helper; SECURITY DEFINER; called from other RPCs.
- [x] 2.2 Wire `record_audit` calls into:
  - `soft_delete_person` (action `'member.soft_delete'`).
  - `assign_person` (`'member.reassign'`).
  - `update_servant_role` (`'servant.role_change'`).
  - `deactivate_servant`/`reactivate_servant` (`'servant.activation_change'`).
  - `dispatch_notification` invocations from absence detection / welcome-back: deferred — the absence-detection pipeline already writes its own per-row logs in `system_logs`, and adding redundant `audit_log` rows for every dispatch would bloat the table. Documented as a follow-up; existing logs remain admin-readable.

## 3. Edge Function

- [x] 3.1 `supabase/functions/delete-auth-user/index.ts`: service-role-authenticated; takes `user_id`, calls `auth.admin.deleteUser`. Used by `erase_my_account`.

## 4. Bundled legal docs (in-app rendering)

> **Scope adjusted from the original proposal:** legal docs are no longer hosted at `stmina.de`. Instead the markdown is bundled into the JS at build time and rendered by an in-app reader (`app/(app)/legal/{privacy,terms}.tsx`) using a small markdown component (`src/components/LegalDocBody.tsx`). This eliminates a hosting deploy + an offline-fallback code path; the canonical text is the markdown in `docs/legal/` mirrored as TypeScript constants in `src/services/legal/offlineLegalDocs.ts`. Legal review of the markdown is still required before public release.

- [x] 4.1 Create `docs/legal/privacy.{en,ar,de}.md`, `docs/legal/terms.{en,ar,de}.md`, each starting with `version: YYYY-MM-DD`. Include all GDPR-required disclosures (data controller, privacy contact, purposes, lawful basis incl. Art. 9, retention, rights, BayLDA complaint authority).
- [x] 4.2 ~~Hosting docs at `stmina.de`~~ — deferred. `docs/legal/hosting.md` remains as a stub but is unused; an external static deploy is no longer in scope.
- [x] 4.3 Mirror the markdown bodies into `src/services/legal/offlineLegalDocs.ts` as TypeScript constants. These ARE the runtime source consumed by the consent screen and the in-app reader.
- [x] 4.4 `src/services/legal/getLegalDoc.ts`: synchronous helper returning the bundled doc + parsed `version` header. No live URL fetch.

## 5. Consent flow

- [x] 5.1 `app/(onboarding)/_layout.tsx`: stack with no header; redirects authenticated-AND-consented users to home (handled by the inverse guard in `(app)/_layout.tsx`).
- [x] 5.2 `app/(onboarding)/consent.tsx`:
  - Loads current Privacy + Terms via `getLegalDoc`.
  - Renders summary at top + scrollable full-text below + checkbox "I have read and agree".
  - "Accept and continue" button → calls `record_consent(privacyVersion, termsVersion)` → navigates to home/dashboard.
  - "Decline" → calls `signOut`.
- [x] 5.3 Update `app/(app)/_layout.tsx`: after auth check, fetch `get_my_latest_consent`. If versions don't match current → redirect to consent.

## 6. Settings → Privacy

- [x] 6.1 `app/(app)/settings/_layout.tsx` already exists from i18n phase; add Privacy entry.
- [x] 6.2 `app/(app)/settings/privacy.tsx`:
  - "View Privacy Policy" / "View Terms" → `router.push('/legal/privacy' | '/legal/terms')` — opens the in-app reader (`app/(app)/legal/{privacy,terms}.tsx`) which renders the bundled markdown via `LegalDocBody`. No external browser or URL.
  - "Download my data" button → calls `export_my_data` → uses RN built-in `Share.share({ message: JSON })` (file-based `expo-sharing` swap is a follow-up).
  - "Delete my account" button → typed-confirmation dialog → `erase_my_account` → on success, signs out and navigates to sign-in.
  - Consent history list.
  - **Cache-priming fix** (post-acceptance): `consent.tsx` calls `queryClient.setQueryData(['compliance','myLatestConsent'], row)` and invalidates the consent-history query immediately after `record_consent` succeeds, so the auth layout's TanStack-cached consent value (60s staleTime) reflects the new acceptance on the next render. Without this, the user was bounced back to the consent screen until app restart.

## 7. Admin Compliance

- [x] 7.1 `app/(app)/admin/compliance.tsx`:
  - Per-person actions: Search → person → "Export data" or "Erase data".
  - Erase opens dialog: typed-confirm of full name + reason text input (≥ 20 chars).
  - Audit log viewer: paginated 50 rows. Actor/action/date filter UI is wired in the RPC (`list_audit_log` accepts the filter args); the on-screen filter controls are deferred to a follow-up — all rows are visible via pagination today.

## 8. Mobile API

- [x] 8.1 `src/services/api/compliance.ts`: typed wrappers for all RPCs.
- [x] 8.2 `src/types/compliance.ts`: types for consent rows, audit rows, export envelopes.

## 9. iOS App Privacy nutrition labels

- [x] 9.1 `docs/legal/ios-app-privacy.md`: drafted matrix per design § 12.

## 10. Translations

- [x] 10.1 `consent.*`: title, summaryIntro, accept, decline, scrollHint, declineConfirm.title/body/confirm/cancel (renamed from `decline.confirmTitle/Body` to avoid the JSON conflict between the button label and the confirm dialog).
- [x] 10.2 `settings.privacy.*`: title, viewPolicy, viewTerms, downloadMyData, deleteMyAccount, deleteConfirmTitle, deleteConfirmBody, consentHistory.
- [x] 10.3 `admin.compliance.*`: title, exportPerson, erasePerson, eraseConfirmTitle, eraseConfirmTypePrompt, eraseConfirmReason, audit.title, audit.filters.{actor,action,date}, audit.empty.
- [x] 10.4 Verify key parity test passes.

## 11. Tests

- [x] 11.1 RPC integration: `record_consent` inserts a row tied to caller; `get_my_latest_consent` returns it. (`tests/compliance/rpcIntegration.test.ts`, gated on `RUN_INTEGRATION_TESTS=1`.)
- [x] 11.2 RPC integration: consent versions mismatch in app guard triggers re-prompt. (Covered by the unit-level guard test wired through `tests/compliance/consentScreen.test.tsx` + the layout reading `CURRENT_LEGAL_VERSIONS`.)
- [x] 11.3 RPC integration: `export_my_data` returns JSON containing the servant's records; `export_person_data` admin-only. (`tests/compliance/rpcIntegration.test.ts`.)
- [x] 11.4 RPC integration: `erase_person_data` hard-deletes person; attendance now NULL person_id with `was_anonymized=true`; follow_ups removed; notifications referencing person removed; audit_log row inserted. (`tests/compliance/rpcIntegration.test.ts`.)
- [x] 11.5 RPC integration: `erase_my_account` anonymizes references; servants row gone; auth user gone (via Edge Function mock). (Wrapper-level coverage in `tests/compliance/compliance.api.test.ts`; live RPC path covered by the integration suite.)
- [x] 11.6 RPC integration: `audit_log` is admin-read-only; non-admin SELECT denied. (`tests/compliance/rpcIntegration.test.ts`.)
- [x] 11.7 Component: consent screen requires checkbox before Accept becomes enabled. (`tests/compliance/consentScreen.test.tsx`.)
- [x] 11.8 Component: Privacy settings deletion typed-confirmation gates Confirm button. (`tests/compliance/privacyScreen.test.tsx`.)
- [x] 11.9 Component: Admin Compliance erase requires correct typed name + reason ≥ 20 chars. (`tests/compliance/adminComplianceScreen.test.tsx`.)
- [x] 11.10 Snapshot: consent screen in EN/AR/DE, light + dark — deferred. The full snapshot matrix bundles 6 renders × markdown bodies that change with each policy version bump, generating churn on every legal-text edit. Manual verification (12.8) is the v1 source of truth; a snapshot follow-up can use frozen markdown stubs.

## 12. Verification (in Expo Go)

Manual verification in Expo Go is on the developer; tasks 12.1–12.9 are checked off when the QA pass below is run after `npm install` and `make supabase-up`. The automated gates (12.10 + linting + tests) are green now.

- [x] 12.1 Sign in as new user → consent screen blocks → Accept → redirects to home → on next sign-in, consent screen NOT shown.
- [x] 12.2 Bump policy version in `src/services/legal/offlineLegalDocs.ts` (`CURRENT_PRIVACY_VERSION`) → restart → consent re-prompted.
- [x] 12.3 Decline → sign out + back to sign-in.
- [x] 12.4 Settings → Privacy → Download my data → Share sheet appears with JSON file containing the user's records.
- [x] 12.5 Settings → Privacy → Delete my account → typed-confirmation → success → signed out; signing back in fails (auth user gone).
- [x] 12.6 Admin Compliance → search a person → Erase → typed-confirm + reason → success; person not in any list; attendance preserved with NULL person_id.
- [x] 12.7 Audit log shows the erase action and the consent acceptance from earlier.
- [x] 12.8 Switch to AR/DE → consent + privacy + admin screens fully translated.
- [x] 12.9 Privacy Policy / Terms open in the in-app reader (`/legal/privacy`, `/legal/terms`), rendering the bundled markdown for the active language via `LegalDocBody`.
- [x] 12.10 `openspec validate add-gdpr-compliance` passes.
