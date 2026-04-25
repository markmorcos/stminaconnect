## Why

With the dev-build infrastructure in place, real push notifications can finally land. Servants need OS-level alerts when they're away from the app — that's the whole point of pastoral follow-up working without requiring the app to be open. The interface defined in phase 7 means swapping the mock for real is a service-layer change with no callers to update.

## What Changes

- **MODIFIED** capability `notifications` — adds real-push implementation.
- **ADDED** `RealNotificationService` implementing the same `NotificationService` interface:
  - On sign-in: requests notification permission via `expo-notifications`, registers Expo push token via `getExpoPushTokenAsync`, persists token + device-info on the `servants` row (new `expo_push_tokens` table — multiple tokens per servant for multi-device).
  - On sign-out: calls Expo Push API to deactivate the token; removes from DB.
  - Subscribes to Realtime as before for in-app delivery (so the inbox/banner UX continues to work).
- **MODIFIED** `dispatch_notification` SQL flow: after inserting into `notifications`, the post-commit trigger or wrapper Edge Function `send-push-notification` reads the recipient's tokens and POSTs to Expo's Push API.
- **ADDED** Token lifecycle:
  - Refresh on app open / foreground.
  - Handle Expo Push API responses (`DeviceNotRegistered` → remove token).
  - Background-message handler.
- **ADDED** `expo_push_tokens` table:
  - `id`, `servant_id`, `token`, `device_info` (jsonb: platform, appVersion, deviceId), `created_at`, `last_seen_at`, `deactivated_at`.
- **ADDED** Quiet hours support per Open Question D3:
  - Per-servant settings: `quiet_hours_start`, `quiet_hours_end` (time of day), `quiet_hours_enabled` (bool default false).
  - Server-side check before sending push: if within quiet hours of recipient, skip the push but still insert in-app notification (in-app banner on next foreground works as before).
- **ADDED** Settings screen `app/(app)/settings/notifications.tsx`: enable quiet hours, set start/end times.
- **ADDED** Translation keys `settings.notifications.*`, `permissions.notifications.*`.
- **MODIFIED** `EXPO_PUBLIC_NOTIFICATION_DISPATCHER` env var: `real` is now wired; mock remains available for tests via env override.

## Impact

- **Affected specs**: `notifications` (modified). Settings extends.
- **Affected code**: new `RealNotificationService.ts`, new `supabase/functions/send-push-notification/`, new migration `027_expo_push_tokens.sql`, `028_quiet_hours.sql`. Modified `dispatch_notification` to fan out via the Edge Function.
- **Breaking changes**: in production builds, mock dispatcher is no longer used. Tests still use mock (configured via env in test setup).
- **Migration needs**: two migrations + Edge Function + Expo project notifications config.
- **Expo Go compatible**: **NO** — first phase that explicitly is not. Requires dev or production build.
- **Dependencies**: `switch-to-development-build`.
