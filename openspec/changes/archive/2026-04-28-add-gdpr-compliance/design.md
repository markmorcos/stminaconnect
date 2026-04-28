## Context

GDPR has six principles (lawfulness/fairness/transparency, purpose limitation, data minimization, accuracy, storage limitation, integrity/confidentiality) and several concrete user rights (Articles 15–22). For a small pastoral app handling sensitive contact data of community members, the relevant subset is:

- **Lawful basis**: legitimate interest of the church for pastoral care; consent for app usage (servants).
- **Article 13/14**: transparent privacy notice on first contact.
- **Article 15**: access — export user's data on request.
- **Article 17**: erasure — delete user's data on request.
- **Article 30**: records of processing (we keep an audit log).
- **Article 32**: technical/organizational measures (RLS, EU hosting, encrypted at rest by Supabase, SecureStore for tokens).

Because members do not log in, we treat _member_ GDPR rights as exercisable by the church on behalf of the member. _Servants_, who do log in, exercise their own rights directly via Settings.

## Goals

- A first-launch consent flow that documents acceptance.
- Clear, multilingual Privacy Policy + Terms of Service.
- Working data export and erasure paths for both members and servants.
- An immutable audit log of sensitive actions.
- A documented retention policy.
- iOS Privacy nutrition labels prepared.

## Non-Goals

- Automated retention enforcement (admin-prompted in v1).
- Data Processing Agreement template generation. We use Supabase's standard DPA.
- A consent management platform (single Privacy + Terms; no granular consent toggles).
- Right to Rectification UI beyond what already exists (admins/assigned servants can edit member data via existing flows).
- Right to Restriction or Object — handled by support process, not in-app.
- BAA / HIPAA-equivalent — not applicable; this is not a healthcare app.

## Decisions

1. **Hosting** the legal docs:
   - Static markdown rendered as HTML on `stmina.de` (a small static site, deployable separately — solo dev probably uses Cloudflare Pages, GitHub Pages, or Netlify; documented in `docs/legal/hosting.md`).
   - In-app: a `WebView` component (or `expo-web-browser` for an in-app Safari/Chrome Custom Tabs experience) renders the live URL. We do not bundle the markdown into the app — the canonical version is the hosted one, ensuring users always see the latest.
   - For offline first-launch, we ship a snapshot version inside the app (read-only fallback) so users can complete consent without network.
2. **Versioning**:
   - Each policy file has a `version` (e.g., `2026-04-25`) at the top.
   - Acceptance row records the version the user accepted.
   - When a new version is published, on next sign-in users see a re-acceptance prompt comparing changes ("Updated April 25, 2026 — see what's new").
3. **Consent flow placement**: a new route `app/(onboarding)/consent.tsx`, displayed as a stack route after sign-in but before the authenticated app. Implemented via the auth guard logic in `app/(app)/_layout.tsx`: after session check, if `latestConsent.policy_version != currentPolicyVersion`, redirect to onboarding consent. Decline → sign out + return to sign-in.
4. **Hard-erasure vs soft-delete**:
   - **Soft-delete** (existing, from phase 6): admin-initiated for "I don't want to track this person anymore." Sets `deleted_at`, scrubs PII; row remains for referential integrity. Reversible by an admin via direct DB intervention (not via app).
   - **Hard-erasure** (new): admin-initiated for "GDPR Article 17 request." Removes `persons` row entirely. Anonymizes `attendance` (sets `person_id=NULL`, `was_anonymized=true`). Deletes `follow_ups` and notifications referencing the person. Records the erasure in `audit_log` with `reason` and `actor_id`. **Irreversible.**
   - The two flows live in different admin screens; soft-delete remains on the person profile, hard-erasure lives in the new Admin Compliance screen with a typed-confirmation + reason field.
5. **`attendance.was_anonymized`**: a small column added to differentiate "we know who attended this event" from "this attendance row used to belong to a person who has been erased." Aggregate stats include both; per-person views exclude anonymized rows.
6. **Servant self-erasure**:
   - Deletes the `servants` row.
   - Anonymizes records the servant created (`persons.registered_by` and `persons.assigned_servant`, `attendance.marked_by`, `follow_ups.created_by`, `audit_log.actor_id`) by setting them to a sentinel servant id `00000000-0000-0000-0000-000000000000` ("Erased Servant").
   - Removes their `auth.users` row via Supabase admin API call (Edge Function).
   - If the erased servant was the assigned_servant for any person, those persons' assignments are reset to a designated "unassigned" admin sentinel; the church admin is alerted via notification to reassign.
7. **Audit log shape**:
   ```
   audit_log (
     id              uuid pk default gen_random_uuid()
     actor_id        uuid                                 -- null for system actions
     action          text not null                        -- e.g. 'member.soft_delete', 'member.erase', 'data.export', 'consent.accept'
     target_type     text                                 -- 'person' | 'servant' | 'attendance' | 'system'
     target_id       uuid
     payload         jsonb default '{}'
     created_at      timestamptz default now()
   )
   ```
   Indexes on `(actor_id, created_at desc)` and `(target_type, target_id)`. Retention: 5 years via a yearly `pg_cron` job removing rows older than 5 years.
8. **Data export format**: a single JSON object representing the person's complete record (or the servant's, for self-export). For admin person-export, a 24-hour signed URL is generated via Supabase Storage to avoid bouncing large payloads through the mobile app. For servant self-export, the JSON is delivered via a `Share` sheet using `expo-sharing` (works in Expo Go).
9. **Privacy Settings UI**: a single screen at Settings → Privacy. Sections:
   - Links to Privacy Policy and Terms (open in-app via expo-web-browser).
   - "Download my data" → generates self-export JSON.
   - "Delete my account" → opens the typed-confirmation flow.
   - Consent history (list of acceptances + versions).
10. **Admin Compliance screen**: lists hard-erasure actions per person (with typed-confirmation + reason field), audit log viewer (filterable by actor, action type, date range, target).
11. **Cookie/tracking disclosure**: the Privacy Policy explicitly states the app uses no analytics, no third-party trackers, no ads, no telemetry. (Crash logs via Supabase Logs are listed as "operational error logs, retained 30 days, not used for tracking.")
12. **Privacy nutrition labels** (iOS): drafted now, submitted with `prepare-store-listings`. Categories:
    - Contact Info: Name, Email, Phone Number — linked to user, not for tracking.
    - User Content: Other (pastoral notes) — linked to user, not for tracking.
    - Identifiers: User ID — linked to user, not for tracking.
    - Diagnostics: Crash data — not linked to user, not for tracking.
13. **DPA**: documented; signed Supabase DPA available in account dashboard. `docs/legal/dpa.md` records the date acknowledged and link to the document.

## Risks / Trade-offs

- **Risk**: GDPR is legally consequential and a developer-only review is insufficient. Mitigation: drafts noted as "drafted; legal review required before production launch" in `docs/legal/`. Solo dev sources external review before public release (out of v1 timeline).
- **Risk**: hard-erasure is irreversible and accidental triggers are catastrophic. Mitigation: typed-confirmation requiring "Erase [Full Name]" exactly, plus a free-text reason ≥ 20 chars, plus an admin-only RPC.
- **Risk**: hosted privacy/terms pages going down breaks legal compliance. Mitigation: bundled offline snapshot serves as fallback; a daily check pings the URL and notifies admin if it 404s.
- **Trade-off**: not auto-enforcing retention (e.g., auto-deleting inactive members). Acceptable; admins prompt on dashboard when retention candidates appear (to be added in a small follow-up; not blocking v1).
- **Risk**: Erased Servant sentinel id is a magic constant. Mitigation: defined once in a migration; documented; type-safe constant in `src/services/api/compliance.ts`.

## Migration Plan

- Four migrations.
- Sentinel "Erased Servant" row inserted via migration.
- Existing test users on first sign-in post-deploy hit the consent screen.
- Audit log starts empty; backfill not required.

## Open Questions

- Confirm hosting domain: `stmina.de`. Could be replaced; documented as a config var.
- None. Legal review of the Privacy Policy and Terms drafts is a release gate captured in `setup-production-deployment` design § 15 — drafts allowed for internal TestFlight/APK pilot; qualified legal review required before public store submission.
