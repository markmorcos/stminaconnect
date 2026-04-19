## Context

Google Calendar is the church's source of truth for events. We must never write to it; we only read. The pull needs to happen server-side so the mobile app does not carry Google credentials and so the polling is centralized. Supabase Edge Functions triggered by `pg_cron` fit this cleanly and run within the free tier budget.

Counted-event configuration is a per-deployment concern (each church's calendar naming differs), so we store patterns in a DB table rather than hardcoding.

## Goals

- Events appear in the app within 1 hour of being created/updated in Google Calendar.
- No Google credentials ever reach the mobile client.
- `is_counted` is recomputed on every sync and whenever a pattern changes — so toggling a pattern immediately affects existing events.
- Admins can see which events are counted in the settings UI.

## Non-Goals

- No real-time Google Calendar webhooks. Polling is fine for hourly granularity.
- No event creation / editing. Calendar remains source of truth.
- No per-event override ("this one doesn't count, despite matching the pattern"). Would add complexity; revisit if needed.
- No support for recurring event exceptions as distinct records — we trust Google's expansion in the API response.

## Decisions

1. **Service account auth with a JWT-signing helper in Deno.** Google's `googleapis` npm library isn't ideal in Deno. We'll use `djwt` to create an OAuth JWT assertion and exchange for an access token, then hit the Calendar API directly. Token caching inside the function's execution to avoid round-trips within one sync.

2. **Rolling window: 30 days past, 30 days future.** Past is needed for late-recording attendance; future is for admins planning ahead. Out-of-window events are purged on sync (`archived_at` set, then a weekly cron hard-deletes anything older than 90 days to keep the table small).

3. **`is_counted` is a materialized boolean in `events`, recomputed on every sync and on pattern changes.** Reason: admin settings UI and absence detection both need a fast read; recomputing on the fly from patterns at query time is wasteful.

4. **Patterns are case-insensitive substring matches.** See Open Question #5. If the admin enters "Sunday Liturgy" and a Google event is titled "Sunday Liturgy — Easter Edition", it counts.

5. **Single calendar ID per deployment (env var).** See Open Question #4. Multiple calendars would require a join table and UI work; a single calendar is enough for v1.

6. **`pg_cron` schedule: `0 * * * *` (top of every hour).** Free-tier budget for Edge Function invocations is generous; 24 invocations/day is a rounding error. A manual "Sync now" button in admin settings triggers an ad-hoc invocation for testing.

7. **Sync is idempotent via upsert on `google_event_id` PK.** Deletes from Calendar are detected by diffing the pulled set against current non-archived rows in the window and marking the difference `archived_at`.

8. **Client access via RPCs, not direct table reads.** Keeps UI independent of the schema (we may add columns without breaking clients).

## Risks / Trade-offs

- **Risk:** Google API quota. The free tier allows many requests/day; at 24/day we're trivially within budget. Monitor in `harden-and-polish`.
- **Risk:** Service account key in Supabase env. Must be rotated on any team member leaving the project. Document in README.
- **Risk:** Title-pattern matching is fragile. If the admin misnames a pattern, events won't count, and absences silently stop firing. The admin settings UI shows a preview of matched events to give immediate feedback.
- **Trade-off:** Hourly polling means up to 1-hour lag for schedule changes. Acceptable for the use case.

## Migration Plan

Migrations 008–011. Rollback strategy: drop tables + cron schedule. No external side-effects since we only read from Google.

## Open Questions

See `_open-questions.md` #4 and #5. Defaults (single calendar, case-insensitive substring) are implemented here.
