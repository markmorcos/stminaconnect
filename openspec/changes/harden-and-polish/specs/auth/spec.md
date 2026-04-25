# auth — Spec Delta

## MODIFIED Requirements

### Requirement: Sessions SHALL persist across app restarts.

The Supabase JS client MUST be configured with `persistSession: true`. From this change forward, auth tokens MUST persist via `expo-secure-store` (not AsyncStorage). On first boot post-deploy, a one-way migration MUST copy any existing session from AsyncStorage to SecureStore and clear the AsyncStorage entry. The Supabase client MUST be configured with the SecureStore-backed storage adapter.

#### Scenario: Existing AsyncStorage session migrates on boot

- **GIVEN** a returning user whose session is stored in AsyncStorage from a prior version
- **WHEN** the app boots after upgrade
- **THEN** SecureStore contains the session
- **AND** AsyncStorage no longer contains the session
- **AND** the user is signed in without re-entering credentials

#### Scenario: Subsequent boots skip the migration

- **GIVEN** SecureStore already has the session
- **WHEN** the app boots
- **THEN** the migration code path runs but performs no work
- **AND** boot completes within normal time

#### Scenario: Fresh install uses SecureStore directly

- **GIVEN** a fresh install on a device with no prior data
- **WHEN** the user signs in
- **THEN** the session is written directly to SecureStore
- **AND** AsyncStorage is never written for auth
