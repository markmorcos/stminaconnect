# Tasks — add-notification-service-mock

## 1. Server

- [ ] 1.1 Migration `007_notifications.sql`:
  - `notifications` table: `id`, `recipient_servant_id`, `type` (text + check constraint), `payload` (jsonb default `'{}'::jsonb`), `read_at` (timestamptz null), `created_at` (timestamptz default now()).
  - Index on `(recipient_servant_id, created_at DESC)`.
  - Index on `(recipient_servant_id) WHERE read_at IS NULL`.
- [ ] 1.2 RLS: `notifications_self_read` (`recipient_servant_id = auth.uid()`); admins can SELECT all (`role = 'admin'`).
- [ ] 1.3 RPC `dispatch_notification(recipient uuid, type text, payload jsonb)` — `SECURITY DEFINER`; admin or service-role only. Inserts a row. Returns notification id.
- [ ] 1.4 RPC `mark_notification_read(notification_id uuid)` — sets `read_at = now()` if `recipient_servant_id = auth.uid()`.
- [ ] 1.5 RPC `mark_all_notifications_read()` — bulk update for `auth.uid()`.
- [ ] 1.6 RPC `unread_notifications_count()` returning integer.
- [ ] 1.7 Enable Realtime on the `notifications` table for INSERT events.

## 2. Type definitions

- [ ] 2.1 `src/services/notifications/types.ts`:
  - `type NotificationType = 'absence_alert' | 'welcome_back' | 'reassignment' | 'system'`.
  - Discriminated union `Notification` with per-type `payload` shapes (placeholder for absence_alert/welcome_back/reassignment until later phases — keep them defined now).
  - `Notification` row mapping helper from server-shape to client-shape.

## 3. Service interface + mock

- [ ] 3.1 `src/services/notifications/NotificationService.ts`: interface `NotificationService` with `dispatch`, `subscribe`, `markRead`, `markAllRead`, `unreadCount$` (Zustand selector or observable).
- [ ] 3.2 `src/services/notifications/MockNotificationService.ts`:
  - Implements `dispatch` by calling `dispatch_notification` RPC.
  - Implements `subscribe` via Supabase Realtime channel filtered to `recipient_servant_id = current servant id`.
  - On Realtime insert: invokes registered callbacks; updates local Zustand state.
  - Optional local-notification fallback gated by `EXPO_PUBLIC_MOCK_LOCAL_NOTIFICATIONS`.
- [ ] 3.3 `src/services/notifications/index.ts`: factory selecting implementation by `EXPO_PUBLIC_NOTIFICATION_DISPATCHER` (default `'mock'`); exports `useNotificationService()` hook.
- [ ] 3.4 `src/state/notificationsStore.ts`: Zustand store of recent notifications + unread count.

## 4. Provider + global state

- [ ] 4.1 `src/services/notifications/NotificationServiceProvider.tsx`: mounts the service on auth, tears down on sign-out.
- [ ] 4.2 In `app/_layout.tsx`: render `<NotificationServiceProvider>` inside `<I18nextProvider>`.

## 5. Banner UI

- [ ] 5.1 `src/components/NotificationBanner.tsx`: Paper `Banner` rendered inside `app/(app)/_layout.tsx`. Visible while `bannerNotification` non-null in the store.
- [ ] 5.2 Banner content: type-specific localized title + body. Action button "View" → deep link via `notificationRouter(type, payload)`. Dismiss button → clears banner without marking read.
- [ ] 5.3 The store auto-dismisses banner after 8s.

## 6. Inbox screen

- [ ] 6.1 `app/(app)/notifications.tsx` — list of notifications grouped by Unread/Read. Pull to refresh.
- [ ] 6.2 Tap notification → mark read + deep link via `notificationRouter`.
- [ ] 6.3 Header right action "Mark all read" → calls `markAllNotificationsRead`.
- [ ] 6.4 Add "Notifications" link with unread-count badge to home screen header.

## 7. Notification router

- [ ] 7.1 `src/services/notifications/notificationRouter.ts`: function `(type, payload) => string | null`. Map `system` → `/notifications`. Map others to `null` for now.

## 8. Translations

- [ ] 8.1 Extend locale files under `notifications.*`:
  - `inbox.title`, `inbox.empty`, `inbox.markAllRead`, `inbox.unreadHeader`, `inbox.readHeader`.
  - `banner.viewAction`, `banner.dismissAction`.
  - `types.absence_alert.title|body` (placeholder — bodies populated in phase 11).
  - `types.welcome_back.title|body` (placeholder).
  - `types.reassignment.title|body` (placeholder).
  - `types.system.title|body`.

## 9. Tests

- [ ] 9.1 Unit: `MockNotificationService` — `dispatch` calls RPC; `subscribe` registers and tears down channels; banner store updates on insert event.
- [ ] 9.2 RPC integration: `dispatch_notification` admin-only; non-admin call rejected.
- [ ] 9.3 RPC integration: `mark_notification_read` only succeeds for own notifications.
- [ ] 9.4 RPC integration: RLS on `notifications` — servant cannot read another servant's notifications.
- [ ] 9.5 Component: Banner renders when store has banner notification; dismiss clears.
- [ ] 9.6 Component: Inbox renders sectioned list; tap calls markRead.

## 10. Verification (in Expo Go)

- [ ] 10.1 As admin via SQL editor: `select dispatch_notification('<servant-id>', 'system', '{}'::jsonb)` → banner appears in the servant's app within ~1s.
- [ ] 10.2 Banner can be dismissed; tap "View" → navigates to inbox; notification shows as Read.
- [ ] 10.3 Restart app → notification still in inbox (persisted server-side).
- [ ] 10.4 Sign out → no banner appears even if a notification is dispatched (subscription torn down).
- [ ] 10.5 Toggle `EXPO_PUBLIC_MOCK_LOCAL_NOTIFICATIONS=true` → local notification appears in the device tray on dispatch.
- [ ] 10.6 Switch language to AR → banner text and inbox headings render in Arabic.
- [ ] 10.7 `openspec validate add-notification-service-mock` passes.
