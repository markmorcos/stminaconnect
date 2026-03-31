# Open Questions

> Last updated: 2026-04-01. Decisions marked with **Decision** were resolved during planning review.

Gaps, ambiguities, and decisions that need resolution before or during implementation.

## Must Resolve Before Phase 2

### OQ-1: Supabase SMS provider for OTP

**Question**: Supabase uses Twilio for phone OTP by default. Is there a Twilio account set up? What's the SMS cost for Germany?

**Decision**: Start with email magic link for development. Switch to phone OTP when Twilio is configured. The auth flow UI already supports both — just swap the Supabase method.

**Impact**: Auth flow in login.tsx.

### OQ-2: How are servants invited/onboarded?

**Question**: The plan says "Admin manages servant accounts (invite by phone/email)." But what's the actual flow?

**Decision**: Option 1 for v1. Admin creates the servant profile (with phone/email), and the servant simply logs in. No invite flow needed — it's a small church. If the phone/email doesn't exist in `servants`, login shows "Not authorized."

**Impact**: Admin settings screen, servant creation API.

### OQ-3: Phone number format — strict E.164 or flexible?

**Question**: Should we enforce strict E.164 (+491234567890) or accept various formats (0171-1234567)?

**Decision**: Store as E.164 always (for uniqueness constraint). Accept flexible input and normalize before save. Validate with Zod regex `^\+[1-9]\d{7,14}$`.

**Impact**: Phone input component, Zod validation schema.

---

## Must Resolve Before Phase 3

### OQ-4: Google Calendar service account setup

**Question**: Who creates the Google service account? Is the church calendar on a personal Google account or a Workspace account?

**Action needed**: Whoever owns the church Google Calendar must:
1. Create a service account in Google Cloud Console
2. Share the calendar with the service account email
3. Provide the JSON key file

**Impact**: Blocks `fetch-events` Edge Function.

### OQ-5: Which events are "counted" for attendance tracking?

**Question**: Is the counted event list static (configured once by admin) or dynamic (every event is counted unless excluded)?

**Decision**: Admin selects event title patterns. Use substring/prefix matching, not exact match. "Sunday Liturgy" matches any event starting with that string. Admin previews which events match before saving.

**Impact**: Alert config UI, `check-absences` Edge Function.

### OQ-6: Attendance — mark absent explicitly or infer from absence?

**Question**: Does the servant explicitly mark someone absent, or is "not marked present" = absent?

**Decision**: Stick with inferred absence. The servant marks present, and after the editable window closes (end of day), everyone NOT marked is considered absent. This matches the spec and keeps UX simple.

**Impact**: Attendance marking screen, `check-absences` logic.

---

## Must Resolve Before Phase 4

### OQ-7: When does absence checking run?

**Question**: Real-time on every attendance sync? Or batch (daily/after each service)?

**Decision**: Option 3. Use pg_cron to schedule absence checks after each counted event's end time (fetched from Google Calendar). This gives timely alerts without real-time noise.

**Impact**: pg_cron setup, `check-absences` trigger logic.

### OQ-8: Duplicate absence alerts

**Question**: If a member misses 5 events (threshold is 3), do they get one alert at 3 misses? Or also at 4, 5?

**Decision**: One alert only. The previous alert must be resolved (completed or snoozed) before a new one fires. The `check-absences` function skips persons with an existing `pending` follow-up for `absence_alert`.

**Impact**: `check-absences` Edge Function logic.

---

## Must Resolve Before Phase 6

### OQ-9: App Store distribution plan

**Question**: Will the app ever go to the App Store / Play Store? Or stay as TestFlight / internal APK permanently?

**Decision**: Stay internal for v1. Revisit after 3 months of real usage. If the church wants wider distribution (other Coptic churches), then submit to stores.

**Impact**: If App Store: need privacy policy, usage description strings, review compliance. TestFlight expires after 90 days (need to rebuild periodically).

### OQ-10: Data backup strategy

**Question**: What happens if Supabase data is lost? Is there a backup plan?

**Decision**: Use `pg_dump` via a cron job on Pi5 for now (free). Move to Supabase Pro backups if the church budget allows.

**Impact**: Deployment, ops.

---

## Nice to Have (Not Blocking)

### OQ-11: Servant self-registration

Could servants register themselves (with admin approval) instead of admin creating profiles? Not needed for v1 with < 10 servants, but worth noting for future.

### OQ-12: Multiple churches

Could the app support multiple Coptic churches? This would require multi-tenancy (org_id on all tables). Not in scope for v1, but affects schema decisions if planned.

**Decision**: Not in v1. If needed, add `church_id` to all tables. Current schema is single-tenant.

### OQ-13: Web admin dashboard

Would a web interface for admins be useful? Expo web could theoretically render the same app. Not in scope for v1, but Expo Router supports web output.

### OQ-14: WhatsApp integration for follow-ups

Servants often use WhatsApp to contact members. Could the app open WhatsApp with a pre-filled message when following up?

**Decision**: Add in Phase 4 as a "Contact via WhatsApp" button on the follow-up detail screen. Low effort, high value. Implementation: `Linking.openURL('whatsapp://send?phone=...')`.

---

## Resolved Codebase Discrepancies (2026-04-01)

These were found during cross-verification of docs vs actual codebase:

| Issue | Resolution |
|---|---|
| NativeWind v4 in tech stack docs, but not configured in codebase | Do not adopt. Continue inline StyleSheet. Remove deps in Phase 6. |
| Phosphor Icons in docs, but `@expo/vector-icons` in code | Use `@expo/vector-icons`. Docs updated. |
| ESLint not configured (`scripts.lint` = `echo 'TODO'`) | Set up in Phase 2 first commits. |
| Jest not configured (no config, no devDeps) | Set up in Phase 2 first commits. |
| Babel path aliases not wired | Wire in Phase 2 first commits. |
