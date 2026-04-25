# Tasks — add-gdpr-compliance

## 1. Schema

- [ ] 1.1 `029_consent_log.sql`: consent_log table; RLS — user can read own rows; admin can read all.
- [ ] 1.2 `030_audit_log.sql`: audit_log table + indexes; RLS — admin-only SELECT; INSERT via SECURITY DEFINER helpers.
- [ ] 1.3 `031_attendance_anonymized.sql`: add `was_anonymized boolean default false` to `attendance`; allow `person_id` to be nullable.
- [ ] 1.4 `031_attendance_anonymized.sql`: insert sentinel "Erased Servant" row in `servants` (id `00000000-0000-0000-0000-000000000000`, role `servant`, deactivated_at set).

## 2. Compliance RPCs

- [ ] 2.1 `032_compliance_rpcs.sql`:
  - `record_consent(policy_version, terms_version)` — caller-scoped insert into consent_log.
  - `revoke_consent(consent_id)` — caller-scoped update setting `revoked_at`.
  - `get_my_latest_consent()` — returns latest acceptance row.
  - `export_person_data(person_id uuid)` — admin-only; aggregates persons + attendance + follow_ups + assignment_history + notifications referencing the person; writes to a Supabase Storage bucket and returns a 24-hour signed URL; logs to audit_log.
  - `export_my_data()` — caller-scoped; returns JSON; logs to audit_log.
  - `erase_person_data(person_id uuid, reason text)` — admin-only; performs the hard-erasure flow per design; logs to audit_log; reason length ≥ 20.
  - `erase_my_account()` — caller-scoped; anonymizes references via the Erased Servant sentinel; deletes `servants` row; deletes auth user via Edge Function.
  - `record_audit(action text, target_type text, target_id uuid, payload jsonb)` — internal helper; SECURITY DEFINER; called from other RPCs.
- [ ] 2.2 Wire `record_audit` calls into:
  - `soft_delete_person` (action `'member.soft_delete'`).
  - `assign_person` (`'member.reassign'`).
  - `update_servant_role` (`'servant.role_change'`).
  - `deactivate_servant`/`reactivate_servant` (`'servant.activation_change'`).
  - `dispatch_notification` invocations from absence detection / welcome-back (action `'system.notify'`).

## 3. Edge Function

- [ ] 3.1 `supabase/functions/delete-auth-user/index.ts`: service-role-authenticated; takes `user_id`, calls `auth.admin.deleteUser`. Used by `erase_my_account`.

## 4. Hosted legal docs

- [ ] 4.1 Create `docs/legal/privacy.{en,ar,de}.md`, `docs/legal/terms.{en,ar,de}.md`, each starting with `version: YYYY-MM-DD`. Include all GDPR-required disclosures (data controller, purposes, lawful basis, retention, rights, contact for DPO).
- [ ] 4.2 `docs/legal/hosting.md`: how to deploy the markdown to `stmina.morcos.tech` (Cloudflare Pages or GitHub Pages instructions).
- [ ] 4.3 Bundle a frozen offline copy under `assets/legal/{privacy,terms}.{en,ar,de}.md` for first-launch fallback.
- [ ] 4.4 `src/services/legal/getLegalDoc.ts`: fetches live copy from URL with offline fallback; parses version header.

## 5. Consent flow

- [ ] 5.1 `app/(onboarding)/_layout.tsx`: stack with no header; redirects authenticated-AND-consented users to home.
- [ ] 5.2 `app/(onboarding)/consent.tsx`:
  - Loads current Privacy + Terms via `getLegalDoc`.
  - Renders summary at top + scrollable full-text below + checkbox "I have read and agree".
  - "Accept and continue" button → calls `record_consent(privacyVersion, termsVersion)` → navigates to home/dashboard.
  - "Decline" → calls `signOut`.
- [ ] 5.3 Update `app/(app)/_layout.tsx`: after auth check, fetch `get_my_latest_consent`. If versions don't match current → redirect to consent.

## 6. Settings → Privacy

- [ ] 6.1 `app/(app)/settings/_layout.tsx` already exists from i18n phase; add Privacy entry.
- [ ] 6.2 `app/(app)/settings/privacy.tsx`:
  - "View Privacy Policy" / "View Terms" → `expo-web-browser.openBrowserAsync(url)`.
  - "Download my data" button → calls `export_my_data` → uses `expo-sharing.shareAsync(file)`.
  - "Delete my account" button → typed-confirmation dialog → `erase_my_account` → on success, signs out and navigates to sign-in.
  - Consent history list.

## 7. Admin Compliance

- [ ] 7.1 `app/(app)/admin/compliance.tsx`:
  - Per-person actions: Search → person → "Export data" or "Erase data".
  - Erase opens dialog: typed-confirm of full name + reason text input (≥ 20 chars).
  - Audit log viewer: filterable by actor, action, date; paginated 50 rows.

## 8. Mobile API

- [ ] 8.1 `src/services/api/compliance.ts`: typed wrappers for all RPCs.
- [ ] 8.2 `src/types/compliance.ts`: types for consent rows, audit rows, export envelopes.

## 9. iOS App Privacy nutrition labels

- [ ] 9.1 `docs/legal/ios-app-privacy.md`: drafted matrix per design § 12.

## 10. Translations

- [ ] 10.1 `consent.*`: title, summaryIntro, accept, decline, scrollHint, decline.confirmTitle, decline.confirmBody.
- [ ] 10.2 `settings.privacy.*`: title, viewPolicy, viewTerms, downloadMyData, deleteMyAccount, deleteConfirmTitle, deleteConfirmBody, consentHistory.
- [ ] 10.3 `admin.compliance.*`: title, exportPerson, erasePerson, eraseConfirmTitle, eraseConfirmTypePrompt, eraseConfirmReason, audit.title, audit.filters.{actor,action,date}, audit.empty.
- [ ] 10.4 Verify key parity test passes.

## 11. Tests

- [ ] 11.1 RPC integration: `record_consent` inserts a row tied to caller; `get_my_latest_consent` returns it.
- [ ] 11.2 RPC integration: consent versions mismatch in app guard triggers re-prompt.
- [ ] 11.3 RPC integration: `export_my_data` returns JSON containing the servant's records; `export_person_data` admin-only.
- [ ] 11.4 RPC integration: `erase_person_data` hard-deletes person; attendance now NULL person_id with `was_anonymized=true`; follow_ups removed; notifications referencing person removed; audit_log row inserted.
- [ ] 11.5 RPC integration: `erase_my_account` anonymizes references; servants row gone; auth user gone (via Edge Function mock).
- [ ] 11.6 RPC integration: `audit_log` is admin-read-only; non-admin SELECT denied.
- [ ] 11.7 Component: consent screen requires checkbox before Accept becomes enabled.
- [ ] 11.8 Component: Privacy settings deletion typed-confirmation gates Confirm button.
- [ ] 11.9 Component: Admin Compliance erase requires correct typed name + reason ≥ 20 chars.
- [ ] 11.10 Snapshot: consent screen in EN/AR/DE, light + dark.

## 12. Verification (in Expo Go)

- [ ] 12.1 Sign in as new user → consent screen blocks → Accept → redirects to home → on next sign-in, consent screen NOT shown.
- [ ] 12.2 Bump policy version in `assets/legal/privacy.en.md` → restart → consent re-prompted.
- [ ] 12.3 Decline → sign out + back to sign-in.
- [ ] 12.4 Settings → Privacy → Download my data → Share sheet appears with JSON file containing the user's records.
- [ ] 12.5 Settings → Privacy → Delete my account → typed-confirmation → success → signed out; signing back in fails (auth user gone).
- [ ] 12.6 Admin Compliance → search a person → Erase → typed-confirm + reason → success; person not in any list; attendance preserved with NULL person_id.
- [ ] 12.7 Audit log shows the erase action and the consent acceptance from earlier.
- [ ] 12.8 Switch to AR/DE → consent + privacy + admin screens fully translated.
- [ ] 12.9 Privacy Policy / Terms open in in-app browser; offline mode falls back to bundled copy.
- [ ] 12.10 `openspec validate add-gdpr-compliance` passes.
