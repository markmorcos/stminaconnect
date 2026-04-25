# admin-dashboard — Spec Delta

## ADDED Requirements

### Requirement: Admins SHALL land on the dashboard after sign-in.

When a signed-in user has `servant.role === 'admin'`, the app's root authenticated route MUST redirect to `/admin/dashboard`. Non-admin servants land on the existing home tile screen.

#### Scenario: Admin lands on dashboard

- **GIVEN** an admin user signs in
- **WHEN** the app navigates after auth
- **THEN** the URL is `/admin/dashboard`
- **AND** the dashboard's sections begin loading

#### Scenario: Non-admin lands on home tiles

- **GIVEN** a non-admin servant signs in
- **WHEN** the app navigates after auth
- **THEN** the URL is `/`
- **AND** the home tiles (Quick Add, Check In, etc.) are visible

### Requirement: The dashboard SHALL render five sections.

The dashboard MUST display, in order:
1. Overview cards (Total members, Active last 30 days, New this month, Avg attendance 4 weeks).
2. Attendance trend line chart.
3. At-risk list grouped by servant.
4. Newcomer funnel.
5. Region breakdown bar chart.

Each section is fed by its own RPC and renders independently of others.

#### Scenario: All sections present

- **WHEN** the admin opens the dashboard
- **THEN** all five sections are visible in the listed order

#### Scenario: Section error does not break others

- **GIVEN** the `dashboard_attendance_trend` RPC fails
- **WHEN** the dashboard renders
- **THEN** the overview cards, at-risk, funnel, and region breakdown all render normally
- **AND** the trend section shows a localized error placeholder with retry

### Requirement: Aggregation queries SHALL run server-side.

Dashboard data MUST come from `dashboard_*` RPCs. The mobile app MUST NOT compute aggregations from raw rows. Stale-time on the client is 5 minutes; pull-to-refresh invalidates all dashboard queries simultaneously.

#### Scenario: Pull-to-refresh refetches

- **GIVEN** the dashboard is displayed with cached data
- **WHEN** the admin pulls to refresh
- **THEN** all five RPCs are re-fetched
- **AND** each card/chart updates as its result arrives

### Requirement: Numbers SHALL be locale-formatted.

All numeric displays (counts, percentages, dates) on the dashboard MUST use `Intl.NumberFormat` and `Intl.DateTimeFormat` with the active i18n language. Phone numbers and IDs are exempt.

#### Scenario: Arabic locale uses Arabic-Indic digits

- **GIVEN** the active language is `ar`
- **AND** the overview shows total members of 142
- **THEN** the rendered number is `١٤٢` (Arabic-Indic digits)

#### Scenario: Percentage rendered with locale

- **GIVEN** funnel conversion of 0.42
- **AND** language is `de`
- **WHEN** rendered
- **THEN** the text is `42 %` (German percent formatting)

### Requirement: Admins SHALL be able to invite, promote, demote, and deactivate servants.

A `/admin/servants` screen MUST list all servants and provide:
- "Invite servant" → opens a modal collecting email, display name, role; on submit calls the `invite-servant` Edge Function.
- "Promote to admin" / "Demote to servant" actions per row (admin-only, calls `update_servant_role`).
- "Deactivate" / "Reactivate" actions per row.

#### Scenario: Inviting a new servant sends a magic link

- **GIVEN** an admin on the servants screen
- **WHEN** the admin invites `new@stmina.de` with display name "John" and role `servant`
- **THEN** the Edge Function creates an `auth.users` row and a `servants` row
- **AND** Supabase sends a magic-link email to `new@stmina.de`

#### Scenario: Non-admin cannot invite

- **GIVEN** a non-admin servant
- **WHEN** the client somehow calls the invite endpoint
- **THEN** the Edge Function returns 403

### Requirement: Deactivation SHALL prevent further sign-in.

Setting `deactivated_at` on a servant row MUST cause `get_my_servant()` to return null for that user. The auth flow already signs out users whose servant row is missing or null; deactivation thus enforces effective sign-out.

#### Scenario: Deactivated servant is signed out on next session refresh

- **GIVEN** servant S has an active session
- **WHEN** an admin deactivates S
- **AND** S's app refreshes the session (foreground transition or RPC error)
- **THEN** `get_my_servant()` returns null
- **AND** the auth store calls signOut
- **AND** S is shown the sign-in screen with the "Account not configured" error

#### Scenario: Deactivated user cannot complete a fresh magic-link sign-in

- **GIVEN** a deactivated servant who clicks a magic link
- **WHEN** the callback completes auth
- **AND** the app fetches `get_my_servant`
- **THEN** the result is null
- **AND** the app signs them out

