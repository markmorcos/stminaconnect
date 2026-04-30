# notifications Specification

## Purpose

Defines the in-app notifications capability: persistence, dispatch, real-time delivery, inbox UX, and the service abstraction that lets the implementation swap from a Realtime-based mock to a push-based real implementation without consumer changes.

## Requirements

### Requirement: A `notifications` table SHALL store every dispatched notification.

The `notifications` table MUST persist every dispatched notification. From this change forward, `welcome_back` rows MUST carry a structured payload containing `personId`, `personName`, `eventTitle`, and `eventDate`. The `notifications` schema itself is unchanged; this is an additive contract on the `payload jsonb` column for the `welcome_back` type.

#### Scenario: Welcome-back payload conforms to typed shape

- **GIVEN** previously-flagged person P attends "Sunday Liturgy" on 2026-04-26
- **WHEN** the post-attendance routine resolves the alert and dispatches a `welcome_back` notification to the assigned servant
- **THEN** the `payload` jsonb contains `personId`, `personName='[P first] [P last]'`, `eventTitle='Sunday Liturgy'`, `eventDate='2026-04-26'`
- **AND** the banner and inbox renderers can derive the localized display strings from these fields without additional joins

### Requirement: A `NotificationService` interface SHALL be the only path the rest of the app uses to dispatch notifications.

`src/services/notifications/NotificationService.ts` MUST export an interface with `dispatch`, `subscribe`, `markRead`, `markAllRead`, and an unread-count signal. Subsequent phases MUST NOT call `supabase.from('notifications').insert(...)` directly from feature code. The interface allows the implementation to swap in phase 17 without consumer changes.

#### Scenario: Calling code uses the hook

- **WHEN** a feature module dispatches a notification
- **THEN** it calls `useNotificationService().dispatch(...)`
- **AND** it does not import the Supabase client to do so

### Requirement: The mock implementation SHALL deliver notifications in-app via Supabase Realtime.

`MockNotificationService` MUST subscribe to a Supabase Realtime channel on the `notifications` table, filtered to the current servant. On INSERT events, the service MUST update the in-app banner state and the inbox state. The subscription MUST tear down on sign-out.

#### Scenario: Banner appears on dispatch

- **GIVEN** servant S signed in, mock service active
- **WHEN** an admin dispatches a notification for S via `dispatch_notification` RPC
- **THEN** within 2 seconds, a Paper Banner appears at the top of S's screen
- **AND** the banner shows the localized title for the notification's type

#### Scenario: Subscription tears down on sign-out

- **GIVEN** servant S signed in, mock service subscribed
- **WHEN** S signs out
- **AND** an admin dispatches a notification for S
- **THEN** no banner appears
- **AND** no Realtime channel for S is active

### Requirement: Dispatch SHALL only succeed from privileged callers.

The `dispatch_notification` RPC MUST only succeed when called by an admin servant or with the Supabase service role key. Non-admin clients calling the RPC directly MUST receive a permission error. Edge Functions in later phases call the RPC using the service role.

#### Scenario: Non-admin direct dispatch is rejected

- **GIVEN** non-admin servant S signed in
- **WHEN** S calls `dispatch_notification(otherServantId, 'system', '{}')` directly
- **THEN** the RPC returns an error

### Requirement: An inbox screen SHALL list all notifications with read/unread state.

`app/(app)/notifications.tsx` MUST display a sectioned FlatList: Unread first, then Read. Tapping a notification MUST mark it read (via `mark_notification_read`) and navigate to the deep link returned by `notificationRouter(type, payload)`. A "Mark all read" header action MUST be available.

#### Scenario: Tap marks read and navigates

- **GIVEN** an unread `system` notification in S's inbox
- **WHEN** S taps the notification
- **THEN** `mark_notification_read` is called
- **AND** the notification moves to the Read section
- **AND** the user is navigated to `/notifications` (the system type's route — same screen for now)

#### Scenario: Mark all read updates section counts

- **GIVEN** S has three unread notifications
- **WHEN** S taps "Mark all read"
- **THEN** all three move to the Read section
- **AND** the unread badge on the home header reads 0

### Requirement: An unread-count badge SHALL appear on the home screen header.

The home screen header right action MUST include a Notifications icon with a numeric badge showing `unread_notifications_count()`. The badge MUST update in real time as notifications arrive or are read.

#### Scenario: Badge increments on dispatch

- **GIVEN** S's badge currently shows 0
- **WHEN** an admin dispatches a notification for S
- **THEN** within 2 seconds the badge displays 1

#### Scenario: Badge zeroes after mark-all-read

- **WHEN** S taps "Mark all read"
- **THEN** the badge displays 0 and is hidden

### Requirement: The dispatcher implementation SHALL be selectable via env var.

The factory in `src/services/notifications/index.ts` MUST select between `mock` and `real` implementations based on `EXPO_PUBLIC_NOTIFICATION_DISPATCHER`. Default is `'mock'`. The `'real'` value resolves to `RealNotificationService`, which registers an Expo push token and forwards taps to `notificationRouter`.

#### Scenario: Default factory returns mock

- **WHEN** the app boots with `EXPO_PUBLIC_NOTIFICATION_DISPATCHER` unset
- **THEN** `useNotificationService()` returns an instance of `MockNotificationService`

#### Scenario: `real` env var selects the real dispatcher

- **WHEN** the app boots with `EXPO_PUBLIC_NOTIFICATION_DISPATCHER='real'`
- **THEN** `useNotificationService()` returns an instance of `RealNotificationService`

### Requirement: A real push dispatcher SHALL deliver notifications to the OS-level notification tray.

`RealNotificationService` MUST be the active implementation in production builds. On dispatch, the server-side flow MUST POST to the Expo Push API and the OS MUST display a notification when the app is backgrounded or closed. In-app behavior (banner, inbox) MUST be identical to the mock dispatcher.

#### Scenario: Background notification appears in tray

- **GIVEN** a signed-in servant with an active token, app backgrounded
- **WHEN** an admin dispatches a notification for that servant
- **THEN** within 5 seconds, an OS notification appears with the localized title and body
- **WHEN** the user taps the notification
- **THEN** the app opens to the deep link computed by `notificationRouter`

#### Scenario: Foreground in-app behavior unchanged

- **GIVEN** the app is foregrounded
- **WHEN** a dispatch occurs
- **THEN** the OS does NOT show a tray entry
- **AND** the Paper Banner appears as in the mock implementation

### Requirement: Push tokens SHALL be registered, refreshed, and deactivated automatically.

On sign-in, the app MUST request notification permission and register an Expo push token. On every foreground transition, the app MUST refresh the token; if it has changed, the new token MUST be persisted and the prior token deactivated. On sign-out, the active token MUST be deactivated.

#### Scenario: Sign-in registers a token

- **GIVEN** a fresh app install in a dev/production build
- **WHEN** a servant signs in and grants notification permission
- **THEN** a row exists in `expo_push_tokens` for the servant with the new token

#### Scenario: Foreground refreshes token

- **GIVEN** a stored token T1
- **WHEN** the app foregrounds and Expo returns a new token T2
- **THEN** T1 is deactivated
- **AND** T2 is upserted

#### Scenario: Sign-out deactivates token

- **WHEN** a servant signs out
- **THEN** the active token row's `deactivated_at` is set to now
- **AND** subsequent dispatches do not POST to Expo for that token

### Requirement: Multiple devices per servant SHALL each receive notifications.

If a servant has multiple active tokens (e.g. phone + tablet), the dispatch flow MUST POST to all active tokens. Each device receives the OS notification independently.

#### Scenario: Two devices both notified

- **GIVEN** servant S has two active tokens T1 (phone) and T2 (tablet)
- **WHEN** a dispatch occurs
- **THEN** both T1 and T2 receive the OS notification

### Requirement: `DeviceNotRegistered` responses SHALL deactivate the offending token.

After POSTing to Expo Push API, the server flow MUST inspect each receipt. Tokens whose receipt indicates `DeviceNotRegistered` MUST be marked `deactivated_at = now()`. Subsequent dispatches MUST NOT include them.

#### Scenario: Uninstalled device's token is removed

- **GIVEN** servant S has token T from a device where the app was uninstalled
- **WHEN** an admin dispatches a notification for S
- **AND** Expo returns `DeviceNotRegistered` for T
- **THEN** T's `deactivated_at` is set
- **AND** the next dispatch sends only to other active tokens

### Requirement: Quiet hours SHALL suppress OS push but not in-app delivery.

Each servant MAY configure a daily quiet-hours window via Settings. When `quiet_hours_enabled=true`, the server flow MUST skip the Expo Push POST if the current time (Europe/Berlin) falls within the window. The in-app `notifications` row MUST still be created so the banner appears on next foreground.

#### Scenario: Within quiet hours: no OS push

- **GIVEN** servant S with quiet hours 22:00–07:00 enabled
- **AND** current Berlin time is 23:30
- **WHEN** a dispatch occurs for S
- **THEN** no Expo Push POST is made for S's tokens
- **AND** a `notifications` row is inserted

#### Scenario: Outside quiet hours: normal delivery

- **GIVEN** the same servant
- **AND** current Berlin time is 14:00
- **WHEN** a dispatch occurs
- **THEN** Expo Push is POSTed normally

#### Scenario: Midnight-crossing window handled

- **GIVEN** quiet hours 22:00–07:00
- **AND** current time 02:00
- **THEN** the time is recognized as inside the window

### Requirement: Push title/body SHALL be localized to the recipient's language.

The Edge Function `send-push-notification` MUST resolve the recipient servant's `language` field and use that locale's translation when constructing the push payload. Unknown / missing translations fall back to `en`.

#### Scenario: Arabic-preferring recipient

- **GIVEN** servant S has `servants.language='ar'`
- **WHEN** an `absence_alert` is dispatched for S
- **THEN** the push title and body are in Arabic
- **AND** the in-app inbox row's display also resolves to Arabic when S views it

### Requirement: Permission denial SHALL not block the app.

If the OS denies notification permission, the app MUST continue to function. The settings screen MUST surface "Notifications disabled by OS" with a button to open the device settings. In-app banners continue to operate (Realtime subscription is independent of push permission).

#### Scenario: Permission denied — app still works

- **GIVEN** a fresh sign-in where the user denies the permission prompt
- **WHEN** a dispatch occurs while the app is foregrounded
- **THEN** the in-app banner appears
- **AND** no OS notification is shown
- **WHEN** the user opens Settings → Notifications
- **THEN** a "Notifications disabled by OS" message is visible with a button to open system settings

### Requirement: The `mock` dispatcher SHALL remain available for tests.

The factory in `src/services/notifications/index.ts` MUST honour `EXPO_PUBLIC_NOTIFICATION_DISPATCHER='mock'`. Tests MUST set this env var so they continue to run against the deterministic mock.

#### Scenario: Tests use mock

- **GIVEN** `process.env.EXPO_PUBLIC_NOTIFICATION_DISPATCHER='mock'` in jest setup
- **WHEN** the factory runs
- **THEN** an instance of `MockNotificationService` is returned
