# follow-up — Spec Delta

## ADDED Requirements

### Requirement: A follow-up SHALL be a logged record of pastoral action against a person.

The `follow_ups` table MUST persist `id`, `person_id`, `created_by`, `action` (enum), `notes`, `status` (enum), `snooze_until`, `created_at`, `updated_at`. A follow-up represents one observation, not a thread.

#### Scenario: Logging a follow-up persists with creator metadata

- **GIVEN** servant S signed in
- **WHEN** S submits a follow-up form for person P with action=texted, notes="Sent prayer", status=completed
- **THEN** a `follow_ups` row exists with `person_id=P`, `created_by=S`, `action='texted'`, `status='completed'`

### Requirement: Follow-up visibility SHALL respect privacy.

Visibility on `follow_ups` MUST be: SELECT visible to the creator and admins only; INSERT allowed to any servant; UPDATE/DELETE allowed only to the creator within 1 hour of creation; immutable thereafter.

#### Scenario: Non-creator non-admin cannot read

- **GIVEN** servant S1 created a follow-up for person P
- **AND** servant S2 (non-admin, not creator) is signed in
- **WHEN** S2 queries follow-ups for P
- **THEN** S1's follow-up is not in the result

#### Scenario: Creator can edit within 1 hour

- **GIVEN** S created a follow-up 30 minutes ago
- **WHEN** S calls `update_follow_up` with new notes
- **THEN** the row is updated

#### Scenario: Editing past 1 hour is rejected

- **GIVEN** S created a follow-up 90 minutes ago
- **WHEN** S calls `update_follow_up`
- **THEN** the RPC returns a permission error

### Requirement: A follow-up form SHALL be reachable from the absence-alert notification.

Tapping an `absence_alert` notification (banner or inbox) MUST navigate to `/persons/[personId]?openFollowUp=true`. The profile page MUST detect the query param and open the follow-up modal automatically.

#### Scenario: Notification deep-link opens follow-up modal

- **GIVEN** servant S has an unread `absence_alert` for person P
- **WHEN** S taps the inbox row
- **THEN** the app navigates to `/persons/P?openFollowUp=true`
- **AND** the follow-up modal sheet is open

### Requirement: Snoozing a follow-up SHALL require a `snooze_until` date.

When `status='snoozed'` is selected on the form, the snooze-until date picker MUST be required (default 3 days from today). On submit, the row stores both fields. The follow-up reappears in the "Snoozed → Returning today/tomorrow" section 1 day before the snooze date.

#### Scenario: Snoozed without date rejected

- **GIVEN** the follow-up form with action=called, status=snoozed, snooze_until empty
- **WHEN** the user taps Save
- **THEN** the form shows an inline error on the date picker
- **AND** no row is created

#### Scenario: Snoozed surfaces near return date

- **GIVEN** a follow-up snoozed_until=2026-04-26
- **WHEN** the pending list is opened on 2026-04-25
- **THEN** the follow-up appears under "Snoozed → Returning today/tomorrow"

### Requirement: A pending follow-ups screen SHALL group items by urgency.

`app/(app)/follow-ups.tsx` MUST render three sections:

1. **Needs follow-up** — `absence_alerts` for the signed-in servant's persons that have no `follow_ups` row, OR have only completed follow-ups but a newer alert exists.
2. **Snoozed → Returning today/tomorrow** — snoozed follow-ups created by the user with `snooze_until <= today + 1`.
3. **Recently logged** — last 20 follow-ups by the user in the last 14 days, **excluding** rows that already qualify for section 2. Sections MUST be disjoint: a single follow-up row appears in exactly one section.

Within each section the rows MUST be ordered by `created_at` descending (newest first) so the most recent activity is at the top.

#### Scenario: New alert without follow-up appears in section 1

- **GIVEN** an unresolved `absence_alerts` row for the user's assigned person P
- **AND** no `follow_ups` exist for P
- **WHEN** the pending screen renders
- **THEN** P appears under "Needs follow-up"

#### Scenario: Snoozed-for-tomorrow follow-up appears only in section 2

- **GIVEN** the user logs a follow-up for person P with `status='snoozed'` and `snooze_until = tomorrow`
- **WHEN** the pending screen renders
- **THEN** the row appears under "Snoozed → Returning today/tomorrow"
- **AND** the same row does NOT appear under "Recently logged"

#### Scenario: Snoozed-far-future follow-up appears in section 3 until return is imminent

- **GIVEN** the user logs a follow-up with `status='snoozed'` and `snooze_until = today + 10`
- **WHEN** the pending screen renders today
- **THEN** the row appears under "Recently logged"
- **AND** when the screen is re-rendered on `today + 9`, the row migrates to "Snoozed → Returning today/tomorrow" and is no longer in "Recently logged"

#### Scenario: Latest first within each section

- **GIVEN** three follow-ups logged at `t1 < t2 < t3` all in "Recently logged"
- **WHEN** the section renders
- **THEN** the row order top-to-bottom is `t3, t2, t1`

### Requirement: "On break" status SHALL pause absence detection for a person.

A profile button MUST allow the assigned servant or any admin to set a person to `on_break` with a `paused_until` date or open-ended (treated internally as 9999-12-31). While on break, `compute_streak` skips counted events whose `start_at < paused_until`.

#### Scenario: Setting a break excludes events from streak

- **GIVEN** counted events E5..E1 in the past
- **AND** P has paused_until covering E5..E2
- **AND** attendance only at E1
- **WHEN** `compute_streak(P)` is called
- **THEN** the result is 0 (E5..E2 skipped; E1 attended)

### Requirement: Breaks SHALL auto-expire daily.

A `pg_cron` job at 23:00 Europe/Berlin MUST set `status='active'` and `paused_until=null` for any person with `paused_until <= current_date`. After the update, `detect_absences` runs for those persons.

#### Scenario: Yesterday's expiry flips status

- **GIVEN** P has `status='on_break'` and `paused_until='2026-04-25'`
- **WHEN** the daily cron runs on 2026-04-26 at 23:00 Berlin
- **THEN** P has `status='active'` and `paused_until=null`
- **AND** `detect_absences([P.id])` was invoked

### Requirement: An "End break early" action SHALL flip status immediately.

When `status='on_break'`, the profile MUST display an "End break early" button visible to the assigned servant or admin. Tapping it sets `status='active'`, `paused_until=null`, and runs detection.

#### Scenario: Manual break end resumes detection

- **GIVEN** P on break with paused_until=next month
- **WHEN** assigned servant taps "End break early"
- **THEN** P's status becomes `active`
- **AND** detection runs synchronously
- **AND** any threshold-crossing alerts dispatch

### Requirement: Marking attendance for an alerted person SHALL resolve the alert and dispatch a welcome-back notification.

When `mark_attendance` commits a row for person P at counted event E, the post-commit routine MUST find the most recent `absence_alerts` row for P with `resolved_at IS NULL` (if any), set `resolved_at=now()`, and dispatch a `welcome_back` notification to the **assigned servant only** (not admins).

#### Scenario: Welcome-back fires only to assigned servant

- **GIVEN** P assigned to S; admins A1, A2; an unresolved alert exists for P
- **WHEN** mark_attendance for P at any counted event commits
- **THEN** the alert's `resolved_at` is set
- **AND** exactly one notification of type `welcome_back` exists with `recipient_servant_id = S.id`
- **AND** no welcome-back notifications exist for A1 or A2

#### Scenario: No alert means no welcome-back

- **GIVEN** P has no unresolved alerts
- **WHEN** mark_attendance commits
- **THEN** no welcome_back notification is dispatched

### Requirement: The `welcome_back` payload SHALL include event context.

The `welcome_back` notification payload MUST include `personId`, `personName`, `eventTitle`, `eventDate`. The translated body uses these to render "{personName} attended {eventTitle} on {eventDate}".

#### Scenario: Banner displays event context

- **GIVEN** a welcome_back notification with personName="Mariam Saad", eventTitle="Sunday Liturgy", eventDate="2026-04-26"
- **WHEN** the recipient sees the banner
- **THEN** the body reads localized "Mariam Saad attended Sunday Liturgy on 2026-04-26"
