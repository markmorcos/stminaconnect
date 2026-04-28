# i18n — Spec Delta

## ADDED Requirements

### Requirement: All translation keys SHALL have native-quality content.

In addition to the parity test from `add-i18n-foundation`, AR and DE translations MUST be reviewed by a native speaker before this change is archived. The review checklist MUST be archived at `docs/i18n-review.md`, listing every key category as Reviewed for each of AR and DE. Translations using mechanical or auto-translated content MUST be replaced with reviewed equivalents.

#### Scenario: Review checklist exists and is signed off

- **WHEN** the change is archived
- **THEN** `docs/i18n-review.md` exists
- **AND** lists every key category as Reviewed for both AR and DE
- **AND** records the reviewer name and date for each language

#### Scenario: Auto-translated content is replaced

- **GIVEN** a key whose AR translation is flagged as machine-translated
- **WHEN** the review is completed
- **THEN** the key's AR value is updated with the human-reviewed wording
- **AND** the parity test continues to pass
