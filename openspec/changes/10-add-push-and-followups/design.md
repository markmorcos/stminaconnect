## Context

This change connects the detection pipeline to servants and back to members. It introduces the most user-visible loop in the product: alert → push → follow-up → resolution (either via action or via return detection). Getting this loop right matters more than anywhere else.

## Goals

- Servant receives a push within 30 seconds of an alert firing (assuming the device is reachable).
- Follow-up log takes ≤ 10 seconds to record the common cases (Called, No Answer).
- Return detection fires reliably when a flagged member attends.
- On-break is a one-tap action; dates are clear; unbreak is automatic.
- Follow-up flow works offline (log an action while out of coverage).

## Non-Goals

- No SMS / email fallback for push in v1. If the servant has push disabled, alerts are visible only in the app. We surface a setting that says so.
- No automatic follow-up templates (e.g., "tap to text"). That's a post-v1 enhancement.
- No admin view of "who has logged follow-ups" in this change — comes in `add-admin-dashboard`.
- No scheduled/delayed push (e.g., "remind me tomorrow").

## Decisions

1. **Expo Push API.** Our mobile app is Expo; this is the natural fit. Tokens are stored per device-per-user; multiple devices per user supported.

2. **`push-dispatch` Edge Function** invoked from (a) the trigger that inserts an `absence_alerts` row and (b) the trigger that resolves an alert on return detection. Deferred via `pg_net`/HTTP call to avoid blocking the writer.

3. **Follow-up action types are a closed enum** in DB: `Called`, `Texted`, `Visited`, `NoAnswer`, `Other`. UI uses segmented control.

4. **On-break stored on `persons`**, not a separate table. Fields: `on_break boolean default false`, `on_break_until date`. Simpler than a history table; we don't need to answer "when did this person last go on break".

5. **Return detection fires exactly once per alert.** Implemented by making `resolved_alerts` transition atomic with the push dispatch; if the dispatch function is re-invoked for the same alert, it is a no-op. See Open Question #8 (auto-return on resume date).

6. **Deep linking**: we extend the `stminaconnect://` scheme with routes like `stminaconnect://follow-up/<alert_id>` and `stminaconnect://person/<id>?banner=welcome-back`. Expo Router reads these.

7. **Follow-up write is offline-capable.** Follow-up creation / snooze / complete queues via the existing `sync_outbox`.

8. **Snoozed follow-ups** aren't truly special — status = `Snoozed` keeps the row visible on the home follow-ups tab with a subdued style. When the servant actually completes, status → `Completed`. A snoozed alert does NOT un-resolve; it just means "I haven't wrapped this up yet".

## Risks / Trade-offs

- **Risk:** Expo push tokens can silently expire (app uninstall, reinstall). Dispatch handles 404s by marking the token dead and trying the next one.
- **Risk:** Notification permission denied at OS level → push silently doesn't fire. We show a banner in Settings prompting re-enable.
- **Trade-off:** Enum-based action types restrict extensibility. Adding a new action type is a migration. Acceptable — prevents free-text proliferation.
- **Trade-off:** Auto-return on resume date (Open Question #8) means a quietly-returning member whose "on break" window ends won't auto-generate an alert spike, since detection skips until the date. We accept a possible delay of one counted event before their streak starts counting again.

## Migration Plan

Migrations 019–022. No destructive operations.

## Open Questions

See `_open-questions.md` #8, #14.
