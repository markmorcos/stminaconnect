# notifications Specification

## Purpose

Defines the in-app notifications capability: persistence, dispatch, real-time delivery, inbox UX, and the service abstraction that lets the implementation swap from a Realtime-based mock to a push-based real implementation without consumer changes.

## Requirements

### Requirement: A `notifications` table SHALL store every dispatched notification.

The `notifications` table MUST persist every dispatched notification. From this change forward, `absence_alert` rows MUST carry a structured payload containing `personId`, `personName`, `consecutiveMisses`, `lastEventTitle`, `lastEventDate`, `priority`, and `thresholdKind`. The `notifications` schema itself is unchanged; this is an additive contract on the `payload jsonb` column for the `absence_alert` type.

#### Scenario: Absence-alert payload conforms to the typed shape

- **GIVEN** absence detection fires for person P with 3 consecutive misses at "Sunday Liturgy" on 2026-04-26
- **WHEN** `dispatch_notification` inserts the row
- **THEN** the `payload` jsonb contains `personId`, `personName='[P first] [P last]'`, `consecutiveMisses=3`, `lastEventTitle='Sunday Liturgy'`, `lastEventDate='2026-04-26'`, `priority`, `thresholdKind='primary'`
- **AND** any consumer (banner, inbox, push) can read these fields without additional joins

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

The factory in `src/services/notifications/index.ts` MUST select between `mock` and `real` implementations based on `EXPO_PUBLIC_NOTIFICATION_DISPATCHER`. Default is `'mock'`. The `'real'` value resolves to `MockNotificationService` for now (real implementation lands in phase 17) but MUST NOT throw — the factory simply documents the slot.

#### Scenario: Default factory returns mock

- **WHEN** the app boots with `EXPO_PUBLIC_NOTIFICATION_DISPATCHER` unset
- **THEN** `useNotificationService()` returns an instance of `MockNotificationService`
