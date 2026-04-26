## Context

Real push notifications via `getExpoPushTokenAsync` no longer work in Expo Go (SDK 53+). We have ~10 phases to ship before flipping to a development build, and several of them (absence alerts, follow-up return) want to "notify a servant". We solve this with the universally useful pattern of an interface + two implementations: mock now, real later. The interface is the only surface every other phase touches.

## Goals

- Define one stable interface every later phase uses: `dispatch(recipient, type, payload)`.
- Make the mock dispatcher feel like a real notification system to the developer (in-app banner, inbox screen, badge counts) so we don't accumulate UX debt.
- Persist notifications server-side so they survive app restart.
- Keep mock and real dispatchers swappable via env flag — phase 17 swaps in real push without touching any caller.

## Non-Goals

- Real Expo Push API integration. That's phase 17.
- Push tokens, permissions handshake, OS-level notification UI in background. Phase 17.
- Email or SMS notification fallbacks. Out of v1.
- Quiet hours / per-user notification preferences. Phase 17 + Open Question D3.
- Cross-device deduplication. Phase 17 problem.

## Decisions

1. **Server-side dispatch is the primary path.** Edge Functions in later phases will call `dispatch_notification` RPC directly (or the equivalent SQL `INSERT`). The mobile-side `NotificationService.dispatch` is a thin wrapper for tests and a few UI-driven cases (e.g. manually marking a follow-up resolved triggers a self-notification — small list).
2. **Realtime subscription, not polling.** Supabase Realtime is included in the JS client and works in Expo Go. Cheap, low-latency, and matches how a real push would behave.
3. **Banner UX**: a Paper `Banner` component anchored at the top of the screen (under the navigation header). Tapping the banner opens the relevant deep link (computed from `type` + `payload`) and marks the notification read.
4. **Inbox screen**: simple FlatList of notifications, sectioned by Unread / Read. Tap any → deep link + mark read. Pull to refresh.
5. **Type taxonomy**: introduce a `NotificationType` union: `'absence_alert' | 'welcome_back' | 'reassignment' | 'system'`. Phase 11+ adds new types. The `payload` field is type-narrowed via a discriminated union per type. We define the schemas now in `src/services/notifications/types.ts` even though no producer fires them yet — keeps the contract stable.
6. **Deep-link router**: a small `notificationRouter(type, payload)` returns a route string. For phase 7, only `system` is implemented (links to inbox). Other types return `null` (no-op tap). Later phases extend this map.
7. **Server-side helper**: a SQL function `dispatch_notification(recipient uuid, type text, payload jsonb)` lives next to other RPCs. Edge Functions in later phases either call this RPC or `INSERT INTO notifications` directly with admin client privileges.
8. **Read state**: server-side via `read_at`. Per-user count of unread notifications is exposed via `unread_notifications_count()` RPC for the home-screen badge.
9. **Mock-as-truth invariant**: when the real dispatcher ships in phase 17, the `notifications` table is still the source of truth — both mock and real implementations write to it. Real adds a fan-out to Expo Push API. This means in-app inbox is unaffected by the mock-vs-real swap.

## Risks / Trade-offs

- **Risk**: Realtime requires the app to be foregrounded. Background notifications don't work with mock-only — that's the whole point of `replace-mock-with-real-push`. Quiet-hours behavior is owned by that later phase (see `replace-mock-with-real-push` design § 7).
- **Risk**: deep-link router becomes a god function. Mitigation: split per type into `src/services/notifications/handlers/{type}.ts` modules, registered into a map.

## Migration Plan

- One migration `007_notifications.sql`.
- No data migration.
- Rollback drops the table.

## Open Questions

- **D1, D2** (alert deduplication, welcome-back audience): not relevant yet — they apply once producers exist (phase 11/12).
- **D3** (quiet hours): deferred to phase 17.
