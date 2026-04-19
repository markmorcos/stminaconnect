# Open Questions

Things that were not explicitly specified and for which a default has been chosen. Each has a **Default** (what has been assumed in the generated proposals) and an **Action** (what needs human decision before the relevant change is implemented). Resolve these inline or by editing the affected proposal before running `/opsx:apply`.

---

## 1. Servant invitation mechanism

**Question:** How are new servants invited? Email from admin? Invite code? Self-signup with allowlist?

**Default chosen:** Admin invites by entering email + role; Supabase sends a magic-link email. Email domain not restricted (servants may use any email). Admin can revoke in a later change.

**Action:** Confirm whether self-signup or domain allowlist is required for v1. If admins want a closed list, no code change needed; if full self-signup is acceptable, we can remove the invite flow.

**Affects:** `add-servant-auth`

---

## 2. Phone number ownership & uniqueness

**Question:** Is a phone number unique across members? Can two family members share a number? Does Quick Add block duplicates?

**Default chosen:** Phone is **NOT** a unique key. Duplicates are allowed (families). Quick Add shows a soft warning ("A member with this phone already exists — [view / continue anyway]") but does not block submission.

**Action:** Confirm. If church wants strict uniqueness (e.g., to block double-registration), flip to hard-block in `add-quick-add-registration`.

**Affects:** `add-person-data-model`, `add-quick-add-registration`

---

## 3. Comment privacy scope — who exactly is "admin"?

**Question:** The spec says comments are private to the assigned servant + admins. If a member is reassigned, does the new servant see prior comments? Can the old servant still see them?

**Default chosen:**
- New assigned servant sees all comments (comments travel with the Person).
- Old servant loses access immediately on reassignment.
- Admins always see all comments.
- Comment history (authorship + timestamp) is preserved.

**Action:** Confirm this matches pastoral expectations. Alternative: comments have per-entry visibility scope.

**Affects:** `add-full-registration`, `add-person-data-model` (RLS)

---

## 4. Google Calendar: which calendar(s)?

**Question:** Single calendar ID, or multiple? What about private events on the church calendar (weddings, baptisms) — do they appear as counted events?

**Default chosen:** Single calendar ID per app instance (`GOOGLE_CALENDAR_ID` env var). Counted-event configuration uses title-pattern matching, so only events matching configured patterns (e.g., "Sunday Liturgy") count — private events are invisible.

**Action:** Confirm single-calendar is sufficient. If the church uses multiple calendars (main, youth, Arabic liturgy), we need an array and a minor schema change.

**Affects:** `add-google-calendar-sync`

---

## 5. Counted-event pattern matching: case sensitivity? fuzzy?

**Question:** Exact-match, substring, regex, or case-insensitive contains?

**Default chosen:** **Case-insensitive substring match.** Admin configures patterns like `sunday liturgy`, `friday vespers`. An event titled "Sunday Liturgy — Easter" matches.

**Action:** Confirm. If admins want regex or exact match, swap in `add-absence-config-and-detection`.

**Affects:** `add-absence-config-and-detection`

---

## 6. Attendance edit window

**Question:** Servants can edit attendance until "end of day" — what timezone? Europe/Berlin? Device local? Configurable?

**Default chosen:** **Europe/Berlin, fixed.** All church operations happen in Munich. Edits allowed until 23:59:59 Berlin time on the day of the event.

**Action:** Confirm. If we ever serve a non-Munich congregation, revisit.

**Affects:** `add-attendance-online`

---

## 7. Absence detection: does a non-counted event reset the streak?

**Question:** Member attends a non-counted event (e.g., youth outing). Does that reset their absence streak?

**Default chosen:** **No.** Streaks are computed over counted events only. Non-counted attendance is still logged (for history) but does not reset the streak.

**Action:** Confirm. Alternative interpretation: any attendance resets the streak (makes the system more forgiving).

**Affects:** `add-absence-config-and-detection`

---

## 8. "On Break" resume date: hard or soft?

**Question:** When the resume date passes, does the member auto-return to active status? Or does a servant have to confirm?

**Default chosen:** **Auto-return.** At the first counted event on or after the resume date, streak calculation resumes from that date (prior absences during break are not counted).

**Action:** Confirm. Some churches prefer the servant confirm the person is back.

**Affects:** `add-push-and-followups`

---

## 9. Servant deletion / deactivation — what happens to assigned members?

**Question:** Admin deactivates a servant. Members assigned to them — do they become unassigned, get reassigned to the admin, or require explicit reassignment?

**Default chosen:** Deactivated servant's members enter a temporary **"unassigned"** state and appear in an admin-only queue for reassignment. No auto-reassignment.

**Action:** Confirm. Alternative: force reassignment at deactivation time (no unassigned state allowed).

**Affects:** `add-servant-auth`, `add-admin-dashboard`

---

## 10. Offline conflict resolution: what if two servants check in the same person to the same event?

**Question:** Last-write-wins by `markedAt` timestamp — but which `markedAt`? The time the tap happened, or the time the sync landed?

**Default chosen:** `markedAt` = time of the tap on the device (captured locally). Sync writes this timestamp to server. Duplicate `(person_id, event_id)` rows are de-duplicated server-side using `ON CONFLICT DO UPDATE`, keeping the latest `markedAt`. Both servants see success; the last row "wins" on `markedBy`.

**Action:** Confirm this is acceptable. It means attribution can flip-flop; the actual attended state is invariant.

**Affects:** `add-offline-sync`

---

## 11. Admin-role elevation: can a servant be promoted to admin?

**Question:** Or are admin and servant roles mutually exclusive?

**Default chosen:** **Single-role model in v1.** A user is either servant or admin. Role can be changed only by another admin. An admin can also be assigned as a servant to specific members (they see those members' follow-ups), but their role is still "admin". This is modeled as a single `role` enum with no multi-role.

**Action:** Confirm single-role is sufficient.

**Affects:** `add-servant-auth`, `add-person-data-model`

---

## 12. Minimum supported OS versions

**Question:** iOS 15? 16? Android 9? 10?

**Default chosen:** **iOS 15+, Android 10+ (API 29).** Matches Expo SDK 52 supported range and covers essentially all devices in a congregation.

**Action:** Confirm. If known servants use older devices, widen this.

**Affects:** `init-project-scaffolding`, `harden-and-polish`

---

## 13. Data retention for inactive members

**Question:** A member goes `status = inactive` for a year. Do we retain their data indefinitely? GDPR right-to-erasure requires a deletion flow — is that in v1?

**Default chosen:** **Retain indefinitely** in v1 (church records are long-lived). GDPR deletion is provided via an admin-triggered "hard delete" action that removes the person and all attendance/follow-up records. No automatic deletion.

**Action:** Confirm scope. A more thorough GDPR posture (data export, consent tracking, audit log export) is out of scope for v1 and should be its own change post-launch.

**Affects:** `harden-and-polish` (adds admin hard-delete action)

---

## 14. Push notifications when app is in background — deep link targets?

**Question:** User taps an absence-alert push — does it open the person's profile, the follow-up screen, or the home?

**Default chosen:** Deep link to the follow-up entry screen for that person, prefilled with action type "No Answer" (nothing committed until servant taps save).

**Action:** Confirm UX. Alternatives: open person profile, or open a centralized "Alerts" inbox.

**Affects:** `add-push-and-followups`

---

## 15. Does the app work on tablets?

**Question:** iPad / Android tablet layout?

**Default chosen:** **Phone-first, tablet usable but not optimized.** No split-view or multi-pane layouts in v1. Layout is responsive but single-column.

**Action:** Confirm. If admins strongly prefer iPad, `harden-and-polish` can add tablet-specific breakpoints.

**Affects:** `harden-and-polish`
