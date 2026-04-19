## Context

The streak algorithm is the single most important piece of business logic in the product. It's also easy to get subtly wrong around edge cases: new members, members on break, members who attend non-counted events, timezone boundaries, retroactive check-ins, etc. We write it carefully, test it exhaustively, and keep the implementation server-side so it's single-source-of-truth.

Member priority matters: we want different thresholds for high-priority members (detect absence sooner) vs low-priority (don't spam servants about casual attendees).

## Goals

- Correct streak computation for all edge cases.
- Fast: detection for 200 members across 1 event takes < 1 second.
- Admin can tune thresholds without code deploy.
- Alerts are deduplicated: never 2 open alerts for the same person at once.
- Resolved alerts (person returns, see next change) don't reappear until a new streak crosses threshold again.

## Non-Goals

- No push notifications in this change — next change.
- No follow-up UI — next change.
- No "On Break" state — next change (it lives in `add-push-and-followups` because it's tangled with the follow-up flow).
- No time-based thresholds ("haven't been in 60 days") — only consecutive-miss thresholds.
- No per-servant configuration — one config per deployment.

## Decisions

1. **Streak = consecutive counted events missed since the latest counted event the person attended.** "Consecutive" is over counted events in chronological order, not calendar days. A person who last attended a counted event on Feb 1 and has missed 3 counted events since now has streak=3, regardless of wall-clock elapsed time.

2. **Non-counted attendance does not reset the streak.** See Open Question #7. Non-counted events are logged but ignored in this algorithm.

3. **New members** (`status = new`, `registered_at` after the most recent counted event) have streak=0 by convention until they've had a chance to attend their first counted event. Formally: we only count missed events that are `>= registered_at`.

4. **`priority_thresholds` is a JSONB map** defaulting to `{ "high": 2, "medium": 3, "low": 4, "very_low": 6 }`. Admin edits via UI. If `alert_priority_thresholds` lacks a key, fall back to `default_threshold`.

5. **Algorithm runs in Postgres**, not Deno. Reason: it's a set-based SQL problem (window functions over ordered counted events) and Postgres is dramatically faster and less flaky than pulling rows to Deno. The Edge Function `detect-absences` is a thin wrapper that calls a `run_absence_detection()` SQL function.

6. **Deduplication**: before inserting, check `absence_alerts` for an existing `open` alert for the same person. If present, no-op.

7. **Triggering event recorded** on the alert (`event_id_triggering`) so we can explain "Maria crossed threshold on [Sunday Liturgy Apr 13]".

8. **Manual attendance edits re-run detection for affected persons.** If a servant unmarks Maria for an event last week, detection re-runs for Maria alone (not a full-table scan). RPC `recompute_absence_for_person(person_id)`.

## Risks / Trade-offs

- **Risk:** The algorithm is non-trivial SQL; bugs could silently miscount. Mitigation: extensive table-driven unit tests with fixed seed data; expected streak values checked against hand-computed truth.
- **Trade-off:** We don't alert on "skipped one counted event then came back" — only on >= threshold streaks. Intentional; avoids noise.
- **Trade-off:** New members' grace period is defined in terms of `registered_at`. If someone registers late (e.g., via Full Registration backfilled), the grace window could be surprising. Acceptable for v1.

## Migration Plan

Migrations 016–018. `absence_config` seeded with one row. No destructive operations.

## Open Questions

See `_open-questions.md` #5, #7.
