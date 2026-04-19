## ADDED Requirements

### Requirement: Crash and error reporting

The app SHALL report uncaught exceptions in both mobile and Edge Functions to Sentry, with PII scrubbed. Sentry is enabled only when `EXPO_PUBLIC_SENTRY_DSN` (mobile) or the Edge Function's `SENTRY_DSN` secret (backend) is set.

#### Scenario: Mobile uncaught exception

- **GIVEN** a build with Sentry DSN configured
- **WHEN** an uncaught exception is thrown in a screen
- **THEN** an error boundary catches it
- **AND** `services/logger.ts` sends the error to Sentry with stacktrace
- **AND** no property containing PII (phone, first_name, last_name, notes, comment) is included

#### Scenario: Edge Function error

- **GIVEN** a deployed Edge Function with Sentry wired
- **WHEN** the handler throws
- **THEN** the error is reported
- **AND** the caller receives a structured `500` response (typed envelope `{ ok: false, code: 'INTERNAL' }`)

#### Scenario: Sentry disabled by default

- **GIVEN** a local dev run with no DSN
- **WHEN** an exception is thrown
- **THEN** no network call is made to Sentry
- **AND** the error still logs to dev console

### Requirement: Error boundaries cover every screen

Every top-level route SHALL be wrapped in an `ErrorBoundary` that displays a localized "Something went wrong" view with a Reload action and logs the error.

#### Scenario: Boundary shown on crash

- **GIVEN** a screen that throws during render
- **WHEN** the user navigates to it
- **THEN** the error boundary displays the localized fallback UI
- **AND** tapping Reload remounts the screen

### Requirement: Typed error envelope across RPCs

All mobile `services/api/*` wrappers SHALL return `{ ok: true, data } | { ok: false, code, message? }`. Screens SHALL map `code` to localized user-facing messages via a central table.

#### Scenario: Error surfaces with localized message

- **GIVEN** an RPC fails with code `EDIT_WINDOW_CLOSED`
- **WHEN** the calling screen handles the result
- **THEN** a localized toast is displayed using the mapped i18n key
- **AND** no raw error shape is shown to the user

### Requirement: No raw stack traces or "undefined" shown to users

No user-visible text in production SHALL include raw stack traces, object dumps, or literal "undefined"/"null".

#### Scenario: Developer safety check

- **GIVEN** a production build
- **WHEN** any error path executes
- **THEN** the displayed text is a human-readable localized message
