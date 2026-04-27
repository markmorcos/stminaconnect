# attendance — Spec Delta

These deltas are introduced by `add-absence-detection`. They couple the
attendance edit window and the check-in picker to the absence-detection
grace knob (`alert_config.grace_period_days`) so servants always have a
backfill path for events the streak walk is currently ignoring.

## MODIFIED Requirements

### Requirement: The edit window SHALL close at 03:00 Europe/Berlin the day after the event.

`mark_attendance` and `unmark_attendance` MUST verify
`now() < event.start_at + (1 + alert_config.grace_period_days) days at 03:00 Berlin`
before applying changes. The roster screen's local pre-check
(`isEventWithinEditWindow`) MUST receive `graceDays` from `alert_config`
and apply the same offset so client and server agree.

When `grace_period_days = 0`, behavior is identical to the original
"03:00 next-day Berlin" cutoff. When `grace_period_days > 0`, the
window slides forward by that many days — letting servants backfill
attendance for events that the absence-detection streak is also
ignoring within the same window.

#### Scenario: Mark inside window succeeds (grace = 0)

- **GIVEN** event E with `start_at = '2026-04-26 10:00 Europe/Berlin'`
- **AND** `alert_config.grace_period_days = 0`
- **AND** current time is `2026-04-27 02:59 Europe/Berlin`
- **WHEN** `mark_attendance(E, [P1])` is called
- **THEN** the row is inserted

#### Scenario: Mark outside window rejected (grace = 0)

- **GIVEN** event E from above
- **AND** `alert_config.grace_period_days = 0`
- **AND** current time is `2026-04-27 03:01 Europe/Berlin`
- **WHEN** `mark_attendance(E, [P1])` is called
- **THEN** the call returns an error
- **AND** no row is inserted

#### Scenario: Mark inside extended window succeeds (grace > 0)

- **GIVEN** event E with `start_at = '2026-04-23 10:00 Europe/Berlin'`
- **AND** `alert_config.grace_period_days = 5`
- **AND** current time is `2026-04-27 02:00 Europe/Berlin`
- **WHEN** `mark_attendance(E, [P1])` is called
- **THEN** the row is inserted (cutoff is `2026-04-29 03:00 Berlin`, comfortably future)

#### Scenario: Roster pre-check matches the server cutoff

- **GIVEN** `alert_config.grace_period_days = 3`
- **AND** the roster screen has fetched alert config
- **WHEN** the screen renders for an event 2 days old
- **THEN** `isEventWithinEditWindow(eventId, 3)` returns `true`
- **AND** rows are tappable; the Save FAB is rendered

## ADDED Requirements

### Requirement: The check-in picker SHALL surface events from the past `grace_period_days` so servants can backfill.

The attendance picker (`/attendance`) MUST query events in the window
`[today − grace_period_days, today + 1 day)` (device timezone) and
render them sorted by `start_at` ascending. The screen title SHALL be
"Recent events" (EN) / "Aktuelle Veranstaltungen" (DE) /
"الاجتماعات الأخيرة" (AR), since the list now spans more than today.

For events that do not fall on the current day, each tile SHALL render
a date prefix (e.g., "Sat, Apr 25 · 09:00 – 10:30") so servants
visually distinguish past events from today's.

The picker MUST gracefully fall back to a default of 3 days when the
`get_alert_config` RPC fails (offline, RLS hiccup) — matching the
migration default and keeping the screen useful when config is
unreachable.

#### Scenario: Picker includes past-grace events

- **GIVEN** `alert_config.grace_period_days = 3`
- **AND** counted events exist 2 days ago, 1 day ago, today
- **WHEN** the picker loads
- **THEN** all three events are listed
- **AND** the past events show a date prefix
- **AND** the today event shows time only

#### Scenario: Picker fallback when config unreachable

- **GIVEN** the device is offline (no cached `alert_config`)
- **WHEN** the picker loads
- **THEN** events from the past 3 days plus today are shown
- **AND** no error banner is displayed

#### Scenario: Title localization

- **WHEN** the picker is rendered with the active language set to EN, DE, or AR
- **THEN** the title reads "Recent events", "Aktuelle Veranstaltungen", or "الاجتماعات الأخيرة" respectively
- **AND** the empty state copy matches the same locale's "No recent events." key
