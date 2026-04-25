## Context

Push notifications are a small but consequential feature: the failure modes are easy to mishandle (token rotation, device de-registration, multi-device, quiet hours). The phase-7 interface design pays off here — every caller stays untouched.

## Goals

- Real OS push notifications when the app is backgrounded or closed.
- Reliable token lifecycle.
- In-app banner and inbox continue to work identically.
- Per-servant quiet hours respected by push but not by in-app.
- Mock dispatcher still available for tests and CI.

## Non-Goals

- Cross-platform push providers (FCM/APNs directly). Stay on Expo Push Service.
- Rich notifications (images, action buttons in tray). Plain title+body in v1.
- iOS critical alerts. Out of v1.
- Per-notification-type opt-in/opt-out. v1 ties enable/disable to the platform-level permission.

## Decisions

1. **Multiple tokens per servant**: a servant may install on phone + tablet. `expo_push_tokens` allows N rows; on dispatch, we send to all active tokens.
2. **Token registration on sign-in**:
   - Request permission via `Notifications.requestPermissionsAsync()`.
   - If granted, fetch token via `Notifications.getExpoPushTokenAsync({ projectId })` — Expo SDK requires the project id.
   - Upsert into `expo_push_tokens` with device info via `Constants.deviceName`, `Platform.OS`, etc.
   - On sign-out: `deactivated_at = now()`, then DELETE on next garbage cron (rather than immediate, in case sign-in soon).
3. **Token refresh**:
   - On every app foreground, `getExpoPushTokenAsync` is called and compared to stored token. If different, upsert new + deactivate old.
4. **DeviceNotRegistered handling**: the Edge Function reads Expo Push API response receipts. Tokens with `errors[].code === 'DeviceNotRegistered'` are deactivated.
5. **Send pipeline**:
   - `dispatch_notification` RPC inserts the `notifications` row as before.
   - A trigger after insert calls a SQL `pg_net` request to the Edge Function `send-push-notification` passing the row id.
   - Edge Function reads notification + recipient tokens, applies quiet-hours check, POSTs to `https://exp.host/--/api/v2/push/send` with title/body localized for recipient's preferred language.
6. **Translation at send time**: title/body for the push must be localized. The Edge Function reads `recipient.language` (we add `language` column to `servants`, default device-locale at sign-up — small migration). Falls back to `en`.
7. **Quiet hours implementation**:
   - Per-servant: `quiet_hours_enabled bool default false`, `quiet_hours_start time`, `quiet_hours_end time`. Times stored without timezone — interpreted as Europe/Berlin local.
   - On send, the Edge Function compares `now() AT TIME ZONE 'Europe/Berlin'::time` to the window; if within, skip Expo Push call.
   - In-app row is always created (banner appears next foreground).
8. **Settings UI**: a single screen with a toggle + two time pickers. Saving updates `servants` row via `update_my_notification_settings` RPC.
9. **Mock-vs-real selection**: factory in `services/notifications/index.ts` checks env var. In production builds, set to `real` via `eas.json`. In tests, override to `mock`.
10. **Permission denied UX**: if permission is denied, show a one-time Snackbar explaining the implications; in-app banner still works. Settings screen shows "Notifications disabled by OS" with a deep link to the device's settings via `Linking.openSettings()`.

## Risks / Trade-offs

- **Risk**: Expo Push Service occasionally returns 4xx for valid tokens (transient). Mitigation: retry once with 30s backoff before deactivating token.
- **Risk**: quiet-hours window crossing midnight (e.g. 22:00–07:00). Mitigation: window math handles wrap-around.
- **Trade-off**: language preference on `servants` is a duplicate of i18n state but needed server-side for push. Acceptable redundancy.

## Migration Plan

- Two migrations + extending `dispatch_notification` flow + new Edge Function.
- Environment: configure Expo project's notifications credentials (APNs key for iOS, FCM key for Android).

## Open Questions

- **D3** resolved (quiet hours per-user, default off).
