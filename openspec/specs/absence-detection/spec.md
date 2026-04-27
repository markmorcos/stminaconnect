# absence-detection Specification

## Purpose

TBD - created by archiving change add-absence-detection. Update Purpose after archive.

## Requirements

### Requirement: A streak SHALL count consecutive missed counted events backwards from now.

`compute_streak(person_id, at)` MUST walk events with `is_counted=true AND start_at < at` ordered by `start_at desc` and count those with no matching `attendance` row for the person, stopping at the first attended event. Persons currently `on_break` (with `paused_until > event.start_at`) MUST have those events skipped (not counted as misses).

The walk additionally MUST ignore events whose `start_at` falls outside `[persons.registered_at, now() - alert_config.grace_period_days]`:

- **Cold-start lower bound** — events before the person's registration timestamp are not real absences and never count, regardless of how far back the calendar reaches.
- **Grace-period upper bound** — events within the grace window have not yet been treated as misses; servants still have time to backfill attendance for them.

#### Scenario: Streak of zero when person attended the most recent counted event

- **GIVEN** counted events E5, E4, E3, E2, E1 (most recent first)
- **AND** attendance exists for person P at E5
- **WHEN** `compute_streak(P)` is called
- **THEN** the result is 0

#### Scenario: Streak of three when person missed last three counted events

- **GIVEN** counted events E5, E4, E3, E2, E1 (most recent first)
- **AND** attendance for P exists at E2 only
- **WHEN** `compute_streak(P)` is called
- **THEN** the result is 3

#### Scenario: On-break window is skipped

- **GIVEN** counted events E5, E4, E3, E2, E1
- **AND** P has `paused_until` covering E4–E3
- **AND** attendance for P at E2 only
- **WHEN** `compute_streak(P)` is called
- **THEN** the result is 1 (E5 missed; E4, E3 skipped; E2 attended)

#### Scenario: Events older than registered_at are ignored (cold-start)

- **GIVEN** person P with `registered_at = today - 1 day`
- **AND** counted events E5 (today − 5 days), E4 (today − 3 days), E3 (today − 1 day) — all missed
- **AND** `grace_period_days = 0`
- **WHEN** `compute_streak(P)` is called
- **THEN** the result is 1 (only E3 falls inside `[registered_at, now]` and is missed; E5 and E4 predate registration and are skipped)

#### Scenario: Events within the grace window are ignored

- **GIVEN** `grace_period_days = 3`
- **AND** counted events E5 (today − 5 days, missed), E4 (today − 2 days, missed), E3 (today − 1 day, missed)
- **WHEN** `compute_streak(P)` is called
- **THEN** the result is 1 (E5 is older than the grace cutoff and counts; E4 and E3 are within the grace window and are skipped)

### Requirement: Alert configuration SHALL be a single admin-managed row.

`alert_config` MUST contain exactly one row. RPCs `get_alert_config()` (read-only for any servant) and `update_alert_config(...)` (admin-only) provide access. A trigger MUST prevent inserting a second row.

#### Scenario: Updating config modifies the singleton

- **WHEN** an admin calls `update_alert_config({ absence_threshold: 4 })`
- **THEN** the single row's `absence_threshold` is now 4
- **AND** no new row is inserted

#### Scenario: Inserting a second config row is rejected

- **WHEN** any caller attempts a direct INSERT into `alert_config`
- **THEN** a trigger raises an exception preventing the insert

### Requirement: A backfill grace period SHALL be admin-configurable.

`alert_config.grace_period_days` (int ≥ 0, default 3) MUST exist as a tunable knob on the singleton row. It governs two behaviors that MUST stay in lock-step:

1. `compute_streak` excludes events newer than `now() - grace_period_days` (see streak requirement).
2. The attendance edit window — both server (`is_event_within_edit_window`) and client local-cutoff check — extends by the same window so servants can backfill attendance for events the streak is still ignoring.

`update_alert_config` MUST accept `p_grace_period_days int default null` and pass it through verbatim. The admin Alerts settings screen MUST surface a numeric field labeled "Backfill grace period (days)" (EN), with localizations in AR and DE.

#### Scenario: Default grace is 3 days

- **WHEN** the singleton `alert_config` row is seeded
- **THEN** `grace_period_days = 3`

#### Scenario: Updating grace flows through to streak math

- **GIVEN** `grace_period_days = 0` and a missed counted event from yesterday
- **WHEN** an admin sets `grace_period_days = 2` via `update_alert_config` and runs `recalculate_absences`
- **THEN** the event is no longer counted by `compute_streak`
- **AND** any prior `absence_alerts` rows that hinged on it remain (uniqueness still holds), but the next call to detection adds no new alert because streaks have shrunk

#### Scenario: Grace below zero is rejected

- **WHEN** an admin attempts to set `grace_period_days = -1`
- **THEN** the column's `check (grace_period_days >= 0)` constraint rejects the write

### Requirement: Per-priority thresholds SHALL override the global threshold.

`alert_config.priority_thresholds` is a JSON map from priority enum to integer. When evaluating a person, the threshold lookup MUST first check the priority-specific value; if null or absent, fall back to the global `absence_threshold`.

#### Scenario: High-priority threshold of 2 fires sooner

- **GIVEN** global threshold 3, priority_thresholds `{ "high": 2 }`
- **AND** person H with priority `high` has streak 2
- **WHEN** detection runs
- **THEN** an `absence_alert` is dispatched for H

#### Scenario: No per-priority entry uses global

- **GIVEN** global threshold 3, no entry for `low`
- **AND** person L (priority `low`) has streak 3
- **WHEN** detection runs
- **THEN** an `absence_alert` is dispatched for L

### Requirement: At most one primary alert SHALL fire per crossing.

The unique constraint `(person_id, threshold_kind, last_event_id)` on `absence_alerts` MUST prevent duplicate primary alerts. Detection runs at multiple cadences (reactive, scheduled) but `INSERT ... ON CONFLICT DO NOTHING` ensures notifications fire only on novel rows.

#### Scenario: Re-running detection after primary fired emits no new notification

- **GIVEN** a primary alert already exists for (P, `last_event_id=E3`)
- **WHEN** detection runs again with no attendance change
- **THEN** no new `absence_alerts` row is created
- **AND** no new notification is dispatched

#### Scenario: New event missed → new crossing → new alert

- **GIVEN** primary alert exists with `last_event_id=E3`
- **AND** P misses the next counted event E4 (streak now N+1)
- **WHEN** detection runs
- **THEN** the existing alert remains
- **AND** because threshold is still met but `last_event_id` is now E4, a new alert row is inserted ONLY if the streak has crossed a higher threshold (escalation), or no new alert otherwise

### Requirement: An escalation alert SHALL fire when configured and the streak exceeds it.

If `alert_config.escalation_threshold` is set (non-null) AND a person's streak `>= escalation_threshold`, a separate alert with `threshold_kind='escalation'` SHALL be dispatched. The same uniqueness rules apply.

#### Scenario: Escalation fires above primary

- **GIVEN** absence_threshold=3, escalation_threshold=6
- **AND** P streak just hit 6 with primary alert already at streak 3
- **WHEN** detection runs
- **THEN** a new `absence_alerts` row with `threshold_kind='escalation'` is created
- **AND** an `absence_alert` notification of escalation kind is dispatched

### Requirement: Alerts SHALL go to the assigned servant, and to admins when configured.

When an alert is dispatched, the system MUST insert one notifications row per recipient. The recipient set MUST include:

- The person's currently-assigned servant (always).
- All admins, if and only if `alert_config.notify_admin_on_alert = true`.

Each row MUST reference the same payload.

#### Scenario: Notify-admin off — only assigned servant alerted

- **GIVEN** notify_admin_on_alert=false; person P assigned to servant S; admins exist
- **WHEN** detection fires an alert for P
- **THEN** exactly one `notifications` row exists with `recipient_servant_id = S.id`
- **AND** no notification rows exist for admins

#### Scenario: Notify-admin on — assigned + admins

- **GIVEN** notify_admin_on_alert=true; assigned S; two admins A1, A2
- **WHEN** detection fires
- **THEN** three notifications exist: one for S, one for A1, one for A2
- **AND** all three carry the same payload

### Requirement: Detection SHALL run reactively after attendance changes.

The `mark_attendance` and `unmark_attendance` RPCs MUST trigger `detect_absences(affected_person_ids)` after the attendance write commits. This ensures alerts fire promptly without waiting for the hourly cron.

#### Scenario: Reactive detection fires immediately

- **GIVEN** person P at threshold 3 with streak 2; current event E about to start
- **AND** the next counted event passes without P being marked
- **WHEN** at any point an attendance change is committed for any other person
- **THEN** detection runs and, if streak now ≥ threshold, dispatches the alert

### Requirement: A scheduled hourly job SHALL re-run detection as a safety net.

`pg_cron` MUST schedule `select detect_absences(null);` hourly. This catches any person whose streak crossed due to an external trigger (e.g. retroactive Google Calendar event sync changing `is_counted`).

#### Scenario: Pattern change retroactively triggers alert

- **GIVEN** event E was previously not counted (no matching pattern), so P's streak was below threshold
- **WHEN** an admin adds a pattern matching E's title
- **AND** the pattern upsert runs `detect_absences(null)` synchronously
- **THEN** the resulting streak crossings dispatch alerts

### Requirement: An admin manual recalculate trigger SHALL be available.

An admin-only RPC `recalculate_absences()` MUST run `detect_absences(null)`. Exposed in the admin Alerts settings screen as a "Recalculate now" button.

#### Scenario: Recalculate from settings dispatches missing alerts

- **GIVEN** changes were made directly in DB without firing detection
- **WHEN** an admin taps "Recalculate now"
- **THEN** any newly-eligible alerts are dispatched

### Requirement: The `absence_alert` notification payload SHALL carry actionable context.

Each `absence_alert` notification MUST include `personId`, `personName`, `consecutiveMisses`, `lastEventTitle`, `lastEventDate`, `priority`, and `thresholdKind`. The notification banner and inbox display SHALL render the localized title and body using these fields.

#### Scenario: Banner shows person name and miss count

- **GIVEN** an alert is dispatched for "Mariam Saad" with 3 consecutive misses
- **WHEN** the recipient sees the banner
- **THEN** the banner shows the localized "Absence alert: Mariam Saad" title and "3 consecutive missed events. Last: Sunday Liturgy." body
