## 1. Schema

- [ ] 1.1 Migration `019_push_tokens.sql`: `push_tokens` (`user_id`, `expo_token`, `device_label`, `created_at`, `last_seen_at`, `revoked_at`); unique `(user_id, expo_token)`
- [ ] 1.2 Migration `020_follow_ups.sql`: enums `follow_up_action` (`Called`, `Texted`, `Visited`, `NoAnswer`, `Other`) and `follow_up_status` (`Completed`, `Snoozed`); `follow_ups` table; RLS
- [ ] 1.3 Migration `021_on_break_columns.sql`: add `on_break boolean default false`, `on_break_until date` to `persons`; index `(on_break, on_break_until)`
- [ ] 1.4 Migration `022_absence_modified.sql`: modify `run_absence_detection` to skip persons where `on_break AND on_break_until > now()`; add trigger `resolve_alert_on_return` that fires on attendance insert into a counted event

## 2. Edge Function: push-dispatch

- [ ] 2.1 Scaffold `supabase/functions/push-dispatch`
- [ ] 2.2 Inputs: `{ kind: 'alert'|'return', person_id, alert_id }`
- [ ] 2.3 Resolves the set of recipient user_ids (assigned servant; admins if `admin_gets_alerts`)
- [ ] 2.4 Collects their `push_tokens`, constructs Expo push messages with localized titles/bodies + deep link url
- [ ] 2.5 Calls Expo Push API; handles errors (404 → revoke token)
- [ ] 2.6 Unit tests (mock Expo API): token revocation, localization per user's preference
- [ ] 2.7 Wire: after alert insert and after resolve, invoke push-dispatch via `pg_net`

## 3. Mobile: push registration

- [ ] 3.1 `services/notifications/index.ts`: request permission, obtain Expo token, upsert into `push_tokens` via RPC `register_push_token`
- [ ] 3.2 Re-register on sign-in; revoke on sign-out (call `revoke_push_token` RPC)
- [ ] 3.3 Handle notification received while app in foreground: show in-app toast with action
- [ ] 3.4 Handle notification tap: parse deep link, route accordingly
- [ ] 3.5 Settings: show current permission state; if denied, prompt to open OS settings

## 4. Mobile: follow-up UX

- [ ] 4.1 `app/(tabs)/follow-ups.tsx`: lists the current user's open alerts grouped: overdue (triggered > 48h ago), recent, snoozed
- [ ] 4.2 `app/follow-up/[alertId].tsx`: segmented action picker, notes field, Completed / Snoozed buttons
- [ ] 4.3 Submit creates a `follow_ups` row (via sync-layer); if action != NoAnswer → also sets alert to `resolved`; No Answer keeps alert open
- [ ] 4.4 Snooze = create a `follow_ups` with status `Snoozed`; alert stays open but the home tab styles the row subdued
- [ ] 4.5 Person detail: add a Follow-Up tab replacing the old Follow-Up stub, listing all follow-ups for this person + quick "New follow-up" button if alert open

## 5. On Break

- [ ] 5.1 Person detail overflow menu: "Mark on break" (assigned servant or admin); opens a bottom sheet to pick resume date (date picker, max 180 days ahead)
- [ ] 5.2 Mark-on-break sets `on_break = true`, `on_break_until = <picked>`; updates via sync layer
- [ ] 5.3 Automatic un-break: when `on_break_until < today`, detection skips the `on_break` flag and treats the person normally. A nightly cron updates `on_break = false` for any row whose `on_break_until` has passed (cosmetic cleanup only)
- [ ] 5.4 Person detail header: if on break, show a "On break until [date]" pill

## 6. Return detection

- [ ] 6.1 Trigger on attendance insert for a counted event: if an open alert exists for that person, set status `resolved`, `resolved_at = now()`
- [ ] 6.2 Enqueue a `push-dispatch` call with `kind = 'return'`
- [ ] 6.3 Deep link target: person profile with `?banner=welcome-back` param; screen shows a green dismissible banner

## 7. i18n

- [ ] 7.1 Add `locales/{en,ar,de}/follow-up.json` and `locales/{en,ar,de}/notifications.json` (push titles, body templates, deep-link landing banners)
- [ ] 7.2 Verify all three languages

## 8. Verification

- [ ] 8.1 Manual: configure threshold 2; skip 2 counted events; detection runs; device receives push within 30s; tapping opens Follow-Up form
- [ ] 8.2 Manual: log a Called follow-up → alert resolves; attend next counted event → no new alert, return push fires since alert already resolved... test edge case
- [ ] 8.3 Manual: mark on break for 2 weeks → skip counted events during break → no alerts
- [ ] 8.4 Manual: offline — log follow-up, snooze → sync works
- [ ] 8.5 Manual: deny push permission → settings surface banner; re-enable → token re-registers
- [ ] 8.6 `make test`, `make lint`, `make typecheck` pass
- [ ] 8.7 `openspec validate add-push-and-followups` passes
- [ ] 8.8 Every scenario in `specs/push-notifications/spec.md`, `specs/follow-up/spec.md`, and the deltas
