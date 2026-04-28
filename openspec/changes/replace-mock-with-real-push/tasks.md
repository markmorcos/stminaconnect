# Tasks — replace-mock-with-real-push

## 1. Schema

- [x] 1.1 `037_expo_push_tokens.sql`: tokens table; RLS owns rows by servant; index on `(servant_id, deactivated_at)`. (`027` was taken; renumbered to `037`.)
- [x] 1.2 `038_quiet_hours.sql`: add columns to `servants`: `language`, `quiet_hours_enabled`, `quiet_hours_start`, `quiet_hours_end`. (Renumbered from `028`.)
- [x] 1.3 RPC `update_my_notification_settings(language, quiet_hours_enabled, quiet_hours_start, quiet_hours_end)` (in `038_quiet_hours.sql`).
- [x] 1.4 RPC `register_push_token(token, device_info)` and `deactivate_push_token(token)` (in `037_expo_push_tokens.sql`).

## 2. Edge function

- [x] 2.1 `supabase/functions/send-push-notification/index.ts` (+ `quietHours.ts`, `translate.ts`, `expoPush.ts`):
  - Receives notification id (from trigger payload).
  - Reads notification + recipient + tokens.
  - Computes localized title/body using a small translation table mirrored from app (or via i18next on Deno).
  - Skips if within recipient's quiet hours.
  - POSTs to Expo Push API; processes response receipts; deactivates DeviceNotRegistered tokens.
- [x] 2.2 Trigger on `notifications` insert calling the Edge Function via pg_net (admin-mode HTTP) (`039_push_dispatch_trigger.sql`; Vault entries seeded via `seed.sql`).

## 3. Mobile real service

- [x] 3.1 `src/services/notifications/RealNotificationService.ts`:
  - `subscribe`: same Realtime subscription as mock (delegated to a composed `MockNotificationService`).
  - On sign-in: request permission, register token, persist via `register_push_token`.
  - On foreground: refresh token, compare, upsert if changed.
  - On sign-out: call `deactivate_push_token`.
  - Background message handler registers `Notifications.addNotificationResponseReceivedListener` to deep-link via the same `notificationRouter`.
- [x] 3.2 Update factory in `src/services/notifications/index.ts` to honour `real` env value.

## 4. Settings screen

- [ ] 4.1 `app/(app)/settings/notifications.tsx`: enable toggle + two time pickers + save.
- [ ] 4.2 If OS permission denied: show "Notifications disabled by OS" + button → `Linking.openSettings()`.

## 5. Translations

- [ ] 5.1 `settings.notifications.*`: title, quietHours, enable, start, end, save, success.
- [ ] 5.2 `permissions.notifications.*`: deniedTitle, deniedBody, openSystemSettings, allowLater.

## 6. Tests

- [ ] 6.1 Unit (Deno): quiet-hours window logic including midnight crossover.
- [ ] 6.2 Unit (Deno): translation fallback to en.
- [ ] 6.3 Integration (mocked Expo Push API): notification with recipient in quiet hours skips Expo POST but still creates in-app row.
- [ ] 6.4 Integration: DeviceNotRegistered receipt deactivates token.
- [ ] 6.5 Component: settings form persists and reloads.
- [ ] 6.6 Component: factory returns RealNotificationService when env var is `real`.

## 7. Verification (in dev client)

- [ ] 7.1 Sign in → permission prompt accepted → token row appears in DB.
- [ ] 7.2 Trigger an absence detection while app is backgrounded → OS push notification appears in tray; tap → app opens to person profile.
- [ ] 7.3 Foreground app + insert another notification → in-app banner (no OS tray duplicate).
- [ ] 7.4 Set quiet hours 22:00–07:00; trigger notification at 23:00 → no OS push; in-app row created; on next foreground banner appears.
- [ ] 7.5 Sign out → token deactivated; subsequent dispatch produces no push.
- [ ] 7.6 Uninstall app; trigger dispatch → Expo returns DeviceNotRegistered; token deactivated automatically.
- [ ] 7.7 `openspec validate replace-mock-with-real-push` passes.
