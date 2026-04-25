## Context

Streak math is straightforward but the *triggering* logic is where bugs hide: alerting on every counted-event evaluation generates fatigue; alerting only once per crossing keeps things sane. Servants also need flexibility — a "high priority" newcomer should generate an alert sooner than a long-term member.

## Goals

- One alert per crossing, deterministic and idempotent.
- Per-priority thresholds with global fallback.
- Optional admin escalation.
- Detection runs reactively (after each attendance change) and on schedule (safety net).
- Notification payload carries enough context for the recipient to act without opening the app.

## Non-Goals

- Reactivation logic (return after absence). Phase 12.
- Custom rules per servant or per region.
- Time-based decay (e.g. "absent for 30 days regardless of event count"). Counted-event streaks only in v1.
- Email/SMS fallback. Real push lands in phase 17; until then, in-app inbox.

## Decisions

1. **Streak definition**: for a person P at time T, walk backwards through counted events (where `is_counted=true`) ordered by `start_at desc` whose `start_at < T`. Count consecutive events with no matching attendance row for P. Stop at the first event with attendance, or when `paused_until > event.start_at` (during a break). Result is the consecutive-miss streak.
2. **Excluded persons**: streak computation skips persons where `status IN ('on_break', 'inactive')` OR `deleted_at IS NOT NULL`.
3. **Threshold evaluation**:
   - Look up `priority_thresholds[person.priority]`. If null, fall back to `alert_config.absence_threshold`.
   - If `streak >= threshold` AND no row exists in `absence_alerts` for `(person_id, threshold_kind='primary', last_counted_event_id_at_crossing)` → fire primary alert.
   - If `escalation_threshold` set AND `streak >= escalation_threshold` AND no row exists for `(person_id, threshold_kind='escalation', ...)` → fire escalation alert.
4. **`absence_alerts` schema**:
   ```
   id              uuid pk
   person_id       uuid not null references persons(id)
   threshold_kind  text not null check (in 'primary','escalation')
   crossed_at      timestamptz not null default now()
   last_event_id   uuid references events(id)
   streak_at_crossing int not null
   resolved_at     timestamptz                          -- set in phase 12 when person attends again
   ```
   Unique on `(person_id, threshold_kind, last_event_id)` — guarantees one row per crossing.
5. **`alert_config` is a singleton row.** A trigger prevents inserting more than one row. RPC `get_alert_config()` and `update_alert_config(...)` are the surfaces.
6. **Recipients**:
   - Always: assigned servant.
   - If `notify_admin_on_alert=true`: all admins.
   - One notification row per recipient.
7. **Notification payload** (typed):
   ```typescript
   type AbsenceAlertPayload = {
     personId: string;
     personName: string;            // "First Last"
     consecutiveMisses: number;
     lastEventTitle: string;
     lastEventDate: string;         // ISO
     priority: 'high'|'medium'|'low'|'very_low';
     thresholdKind: 'primary'|'escalation';
   }
   ```
8. **Trigger vs. scheduled** approach: detection runs both ways.
   - **Reactive**: after `mark_attendance` / `unmark_attendance` RPCs commit, fire-and-forget `select detect_absences(person_ids)` for the affected persons only.
   - **Scheduled**: hourly `pg_cron` invokes `detect-absences` Edge Function for all persons in case of triggers missed (e.g. retroactive event sync changed `is_counted`).
9. **Edit-window race**: when an attendance row is inserted retroactively, the absence detection might already have fired. Mitigation: `unmark_attendance` re-runs detection, which checks if the prior alert's `last_event_id` is now past — but does NOT auto-resolve the alert. Phase 12 (return detection) handles resolution properly.
10. **Counted-event pattern change**: when an admin updates patterns (phase 8 RPC), `is_counted` is recomputed for the rolling window — and the recompute MUST also trigger absence re-detection for affected persons. We extend `upsert_counted_event_pattern` / `delete_counted_event_pattern` to call detection after the recompute.
11. **Deep-link mapping** (notification router): `absence_alert` deep links to `/persons/[personId]`. Phase 12 will swap this to a follow-up creation flow.

12. **Implicit absence is the model** (re-asserts `add-attendance-online-only` § 2): only present check-ins are stored; no explicit "absent" rows exist. `compute_streak` walks counted events backward and counts every event with no matching `attendance` row for the person as a miss. This means a missing attendance row IS the absence signal — no separate ingestion path or absence-marking UI is needed.

13. **One attendance per counted event for streak math**: each Google Calendar event is counted independently. If two counted events fall on the same calendar day (e.g. "Sunday Liturgy" + "Vespers"), they are two independent opportunities to break a streak — a person who attends only the morning Liturgy retains a clean streak for that event but accumulates a miss for Vespers if Vespers matches a counted-event pattern. Streak walk does not collapse same-day events.

14. **Counted-event pattern syntax** (uses the `add-google-calendar-sync` decision verbatim): case-insensitive substring match against `events.title`. Multiple patterns are OR'd. Regex deferred to v2. Detection re-runs whenever patterns change (already wired via `upsert_counted_event_pattern` / `delete_counted_event_pattern`).

## Risks / Trade-offs

- **Risk**: streak computation over many persons × many events is N×M. With 200 × ~75 events ≈ 15k rows scanned, it's fast in Postgres. We add an index `(person_id, event_id)` on `attendance` if not already present. Won't scale past 1k members but doesn't need to.
- **Risk**: a counted-event re-classification can flood servants with alerts. Mitigation: the detect-absences function checks `(person_id, threshold_kind, last_event_id)` uniqueness — so we only fire on novel crossings.
- **Trade-off**: not handling time-based decay means a person who was last seen 6 months ago but has been "on break" the whole time won't auto-alert when the break ends. Acceptable — the on-break flag is admin-managed and admins can manually run `recalculate_absences()`.

## Migration Plan

- Two migrations + the trigger / cron registration.
- `alert_config` seeded with defaults.

## Open Questions

- **D1** resolved (one alert per crossing, optional escalation).
- **D2** is for phase 12.
