# person-management — Spec Delta

## ADDED Requirements

### Requirement: An admin-only hard-erasure path SHALL exist alongside soft-delete.

The existing soft-delete (introduced in `add-full-registration`) MUST be retained for general churn. A new admin-only path, accessible only via the Admin Compliance screen at `app/(app)/admin/compliance.tsx`, MUST perform irreversible hard-erasure for GDPR Article 17 requests. The two paths MUST NOT be conflated in the UI: soft-delete is on the person profile; hard-erasure is on Admin Compliance.

The hard-erasure RPC `erase_person_data(person_id, reason)` MUST require a free-text reason of at least 20 characters and MUST log the action to `audit_log`. The action MUST be irreversible from the in-app UI.

#### Scenario: Soft-delete and hard-erasure are distinct UI paths

- **WHEN** an admin opens a person profile
- **THEN** the visible delete affordance is "Remove member" (soft-delete)
- **AND** no "Erase data" affordance is present on the profile screen

- **WHEN** the admin navigates to Admin Compliance
- **THEN** the visible delete affordance is "Erase data" (hard-erasure)
- **AND** the affordance is labelled as irreversible

#### Scenario: Hard-erasure requires reason

- **GIVEN** an admin in the Admin Compliance erase dialog for a person
- **WHEN** the typed name matches but reason is shorter than 20 characters
- **THEN** the Confirm button remains disabled
- **AND** no RPC is called
