## Why

Subsequent phases (absence detection, follow-up return detection) need to "send a notification" to a servant. Real Expo push doesn't work in Expo Go since SDK 53. Rather than block on a development build, we introduce a `NotificationService` interface now and ship a mock dispatcher that persists notifications in Postgres and delivers them in-app via Supabase Realtime + a banner UI. The same interface will accept a real-push implementation in phase 17 — every later phase calls into this abstraction without caring which dispatcher is wired.

## What Changes

- **ADDED** capability `notifications`.
- **ADDED** `notifications` table:
  - `id`, `recipient_servant_id`, `type` (enum), `payload` (jsonb), `read_at`, `created_at`.
  - RLS: a servant reads only their own notifications; admins read all.
- **ADDED** `dispatch_notification(recipient_servant_id uuid, type text, payload jsonb)` RPC — the server-side `NotificationService` entry point. Inserts a row.
- **ADDED** Mobile-side `NotificationService` interface in `src/services/notifications/NotificationService.ts`:
  - `dispatch(userId, type, payload)` — used by the **client** for tests and UI feedback (rare; most dispatch happens server-side from Edge Functions).
  - `subscribe(callback)` — register an in-app listener.
  - `markRead(notificationId)` / `markAllRead()`.
- **ADDED** `MockNotificationService` implementation:
  - On app foreground: subscribes to `notifications` Realtime channel filtered to `recipient_servant_id = current servant id`.
  - On insert: shows in-app Snackbar/banner ("You have a new alert").
  - Persists notifications offline (handled in phase 10 — until then, online-only).
- **ADDED** Notification banner UI: top-of-screen Paper `Banner` component triggered by service.
- **ADDED** Notifications inbox screen `app/(app)/notifications.tsx`: list of all notifications, tap to mark read, tap-through to a payload-typed deep link (e.g. an absence alert links to a person profile — though no absence types exist yet; the deep-link mapping is structured).
- **ADDED** `NotificationServiceProvider` in `app/_layout.tsx` selecting Mock vs Real (Real not implemented yet) based on `EXPO_PUBLIC_NOTIFICATION_DISPATCHER` env var (default: `mock`).
- **ADDED** Translation keys for `notifications.*`.

## Impact

- **Affected specs**: `notifications` (new).
- **Affected code**: new `src/services/notifications/*`, new `app/(app)/notifications.tsx`, `app/_layout.tsx` (provider mount), `supabase/migrations/008_notifications.sql`. New banner component.
- **Breaking changes**: none.
- **Migration needs**: one migration.
- **Expo Go compatible**: yes — the mock dispatcher uses Supabase Realtime + Paper Banner, both of which work in Expo Go.
- **Uses design system**: all UI built with components/tokens from the design-system capability. No ad-hoc styles. (The notification banner is a thin wrapper of the design-system `Banner`/`Snackbar`; the inbox uses design-system list primitives.)
- **Dependencies**: `add-servant-auth`, `add-i18n-foundation`, `init-project-scaffolding`.
