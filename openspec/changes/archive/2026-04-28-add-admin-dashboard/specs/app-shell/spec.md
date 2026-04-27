# app-shell — Spec Delta

## ADDED Requirements

### Requirement: Primary navigation SHALL be a four-tab bottom bar.

The authenticated app MUST present primary navigation as a bottom tab bar with four items, in this order: Home, Persons, Follow-ups, Settings. Labels MUST be translated via `tabs.*` keys. The active tab MUST be visually distinguished using design-system tokens (no ad-hoc colors). The tab bar MUST appear on the four root routes and MUST NOT appear on sub-routes (registration flows, attendance, notifications, dev tools, settings sub-pages, admin sub-pages, person profile).

#### Scenario: Tab bar visible on root routes

- **GIVEN** a signed-in user (admin or servant)
- **WHEN** any of `/`, `/persons`, `/follow-ups`, or `/settings` is the active route
- **THEN** the bottom tab bar is visible with all four items
- **AND** the active item matches the current route

#### Scenario: Tab bar hidden on sub-routes

- **WHEN** the user opens `/registration/quick-add`, `/registration/full`, `/attendance`, `/notifications`, `/persons/[id]`, `/settings/account`, `/settings/language`, `/admin/counted-events`, `/admin/alerts`, `/admin/servants`, `/about`, or `/dev/*`
- **THEN** the bottom tab bar is not rendered
- **AND** the screen presents a back affordance to its parent

### Requirement: The Home tab SHALL render role-aware content without a redirect.

The Home tab (route `/`) MUST render the admin dashboard component for users with `servant.role === 'admin'`, and the existing launcher tile screen for users with `servant.role === 'servant'`. The selection MUST happen inside `app/(app)/index.tsx` — no `Redirect` to a different URL. The URL of the Home tab MUST remain `/` for both roles, so deep-linking and tab state stay consistent.

#### Scenario: Admin sees dashboard at root

- **GIVEN** a signed-in admin
- **WHEN** the Home tab is active
- **THEN** the URL is `/`
- **AND** the admin dashboard's sections render

#### Scenario: Servant sees launcher at root

- **GIVEN** a signed-in non-admin servant
- **WHEN** the Home tab is active
- **THEN** the URL is `/`
- **AND** the launcher tiles (Check In, Quick Add, Register full, Persons list) render

#### Scenario: Role change is reflected without sign-out

- **GIVEN** a signed-in servant whose role is changed to admin while the Home tab is open
- **WHEN** the auth store re-reads `get_my_servant()`
- **THEN** the Home tab swaps to the admin dashboard without a navigation event

### Requirement: Each root tab SHALL render a header with a notifications bell and a dev-only overflow menu.

Every root tab screen MUST render a header containing the screen title, a bell icon (with unread badge wired to `notificationsStore.unreadCount`) that navigates to `/notifications`, and — only when `__DEV__ === true` OR `EXPO_PUBLIC_SHOW_DEV_TOOLS === 'true'` — an overflow (kebab) menu containing development-only entries (DB Inspector, Showcase, and any future dev tools). In production builds the overflow menu MUST NOT render at all (no empty kebab affordance). The header MUST consume design-system tokens; no ad-hoc colors or sizes.

#### Scenario: Bell badge reflects unread count

- **GIVEN** there are 3 unread notifications
- **WHEN** any root tab header renders
- **THEN** the bell shows a badge with "3"

#### Scenario: Bell with no unread

- **GIVEN** there are 0 unread notifications
- **WHEN** any root tab header renders
- **THEN** the bell renders without a badge

#### Scenario: Overflow menu hidden in production

- **GIVEN** a production build where `__DEV__` is false and `EXPO_PUBLIC_SHOW_DEV_TOOLS` is unset
- **WHEN** any root tab header renders
- **THEN** there is no overflow icon at all

#### Scenario: Overflow menu visible in dev

- **GIVEN** `__DEV__` is true
- **WHEN** the user taps the overflow icon on any root tab
- **THEN** the menu lists dev tools (DB Inspector, Showcase) and nothing else

### Requirement: The Settings tab SHALL be a sectioned landing screen consolidating account, language, about, sign-out, and admin sub-pages.

The Settings tab (route `/settings`) MUST render a sectioned list, with sections in this order:

1. App: rows for Account → `/settings/account`, Language → `/settings/language`, About → `/about`.
2. Admin (rendered only when `servant.role === 'admin'`): rows for Counted Events → `/admin/counted-events`, Alert thresholds → `/admin/alerts`, Servants → `/admin/servants`.
3. A divider followed by Sign Out, styled as a destructive action.

Section headers MUST be translated via `settings.section.*` keys. The Admin section header MUST be hidden entirely for non-admins (no empty header). Sign Out MUST trigger the existing `useSignOutWithGuard` flow so that pending offline writes still prompt confirmation.

#### Scenario: Servant settings landing

- **GIVEN** a non-admin servant
- **WHEN** the Settings tab is opened
- **THEN** rows for Account, Language, About, and Sign Out are visible
- **AND** no Admin section header or rows are visible

#### Scenario: Admin settings landing

- **GIVEN** an admin
- **WHEN** the Settings tab is opened
- **THEN** the App section rows (Account, Language, About) are visible
- **AND** the Admin section is visible with Counted Events, Alert thresholds, and Servants
- **AND** Sign Out is the last row, styled destructively

#### Scenario: Sign-out preserves the existing guard

- **GIVEN** there are pending offline writes in the sync queue
- **WHEN** the user taps Sign Out from Settings
- **THEN** the existing sign-out confirmation dialog opens before the session is cleared

### Requirement: Previously kebab-only destinations SHALL be reachable through the new shell.

After this change, the header overflow menu MUST NO LONGER expose user-navigable items (About, Settings, Account, Pending follow-ups, Counted Events, Alerts, Sign Out). Each of those destinations MUST instead be reachable via:

- Follow-ups → the Follow-ups tab.
- Account, Language, About, Sign Out → the Settings tab.
- Counted Events, Alerts, Servants → Settings → Admin section (admin only).

#### Scenario: No kebab entries duplicate tab destinations

- **GIVEN** a dev build with the overflow menu visible
- **WHEN** the user opens the overflow menu on any root tab
- **THEN** only development tools appear
- **AND** no entry duplicates a destination already reachable from the tab bar or Settings

#### Scenario: Production kebab is absent entirely

- **GIVEN** a production build
- **WHEN** any root tab is open
- **THEN** there is no overflow icon at all
- **AND** every previously-kebab destination is still reachable through tabs or Settings
