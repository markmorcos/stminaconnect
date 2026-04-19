## ADDED Requirements

### Requirement: Device token registration

On each sign-in (and on permission grant), the app SHALL request notification permission, retrieve the Expo push token, and upsert it into `push_tokens` for the current user. On sign-out, the token SHALL be marked revoked.

#### Scenario: Permission granted

- **GIVEN** a user signs in on a fresh device
- **WHEN** the notifications service initializes
- **THEN** the app requests permission
- **AND** on grant, obtains the Expo token
- **AND** upserts a `push_tokens` row (`user_id`, `expo_token`, `device_label`)
- **AND** `last_seen_at = now()`

#### Scenario: Permission denied

- **GIVEN** the user denies notification permission
- **WHEN** the service initializes
- **THEN** no token is stored
- **AND** a banner appears in Settings warning "Notifications are disabled — you won't get absence alerts. [Open settings]"

#### Scenario: Sign-out revokes

- **GIVEN** a signed-in user with a registered token
- **WHEN** they sign out
- **THEN** the token is revoked (`revoked_at = now()`) via the `revoke_push_token` RPC

### Requirement: Absence-alert notification

When an `absence_alerts` row is inserted with `status = 'open'`, a push notification SHALL be sent to every non-revoked `push_token` of the assigned servant, and also to admins if `absence_config.admin_gets_alerts = true`.

#### Scenario: Push reaches assigned servant

- **GIVEN** servant A is Maria's assignee and has a valid push token
- **WHEN** an `open` alert is inserted for Maria
- **THEN** `push-dispatch` is invoked
- **AND** A's device receives a notification within 30 seconds with title like "Maria hasn't been in 3 Sundays"
- **AND** body and title are in A's preferred language

#### Scenario: Admin gets alert when enabled

- **GIVEN** `admin_gets_alerts = true`; one admin with a valid push token
- **WHEN** Maria's alert is inserted
- **THEN** the admin also receives a push

#### Scenario: Admin does NOT get alert when disabled

- **GIVEN** `admin_gets_alerts = false`
- **WHEN** Maria's alert is inserted
- **THEN** admin receives no push
- **AND** servant still receives push

### Requirement: Return-detected notification

When an `open` alert is resolved because the person attended a counted event, a push notification SHALL fire to the assigned servant (and admins if enabled) with a "Welcome back" style message.

#### Scenario: Maria returns

- **GIVEN** Maria has an open alert assigned to servant A
- **WHEN** Maria is marked present at a counted event (today)
- **THEN** the alert's status becomes `resolved` atomically with trigger
- **AND** a push fires to A: "Maria came back today — welcome her!"

### Requirement: Deep links to relevant screen

Absence pushes SHALL deep-link to `stminaconnect://follow-up/<alertId>`. Return pushes SHALL deep-link to `stminaconnect://person/<id>?banner=welcome-back`.

#### Scenario: Tap absence push opens follow-up

- **GIVEN** an unread absence push
- **WHEN** the servant taps it
- **THEN** the app opens (foreground or cold start) directly to `/follow-up/<alertId>` with the form pre-filled to action type "NoAnswer"

#### Scenario: Tap return push opens person with banner

- **GIVEN** an unread return push
- **WHEN** the servant taps it
- **THEN** the person profile opens with a green "Welcome back" dismissible banner at top

### Requirement: Dead-token handling

When Expo Push API returns a 4xx indicating invalid/revoked token, `push-dispatch` SHALL mark that `push_tokens` row `revoked_at = now()` and continue attempting the user's other tokens.

#### Scenario: Uninstalled app stops getting pushes

- **GIVEN** a user uninstalled the app; their token is invalid
- **WHEN** a push is dispatched
- **THEN** Expo returns `DeviceNotRegistered`
- **AND** the token is marked revoked
- **AND** no further attempts are made to that token
