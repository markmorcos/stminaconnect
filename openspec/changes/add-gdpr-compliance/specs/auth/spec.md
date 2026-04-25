# auth — Spec Delta

## MODIFIED Requirements

### Requirement: Authenticated routes SHALL be guarded.

Routes under `app/(app)/*` MUST be reachable only with a non-null `session`. Routes under `app/(auth)/*` MUST be reachable only when `session` is null. From this change forward, route guarding MUST also enforce consent: after session and servant-row checks, the authenticated layout MUST verify `get_my_latest_consent()` returns a row whose `policy_version` and `terms_version` match the currently-published versions. If the check fails, the user MUST be redirected to `app/(onboarding)/consent.tsx` instead of any `app/(app)/*` route.

#### Scenario: Unauthenticated user is redirected from protected route

- **GIVEN** no session is present
- **WHEN** the user navigates to any route under `app/(app)/*`
- **THEN** they are redirected to `app/(auth)/sign-in.tsx`
- **AND** no protected screen is briefly rendered before the redirect

#### Scenario: Authenticated user without current consent is redirected to consent

- **GIVEN** a signed-in user with a valid `servants` row
- **AND** no consent acceptance, OR an acceptance whose versions do not match the current published versions
- **WHEN** the user attempts to navigate to any `app/(app)/*` route
- **THEN** they are redirected to `app/(onboarding)/consent.tsx`
- **AND** no other authenticated screen renders

#### Scenario: Authenticated user with current consent reaches home

- **GIVEN** a signed-in user with a current consent acceptance matching published versions
- **WHEN** the user navigates to `app/(app)/index.tsx` or `app/(app)/admin/dashboard.tsx`
- **THEN** the destination renders normally
