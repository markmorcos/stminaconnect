# notifications — Spec Delta

## MODIFIED Requirements

### Requirement: A `notifications` table SHALL store every dispatched notification.

The `notifications` table MUST persist every dispatched notification. From this change forward, `welcome_back` rows MUST carry a structured payload containing `personId`, `personName`, `eventTitle`, and `eventDate`. The `notifications` schema itself is unchanged; this is an additive contract on the `payload jsonb` column for the `welcome_back` type.

#### Scenario: Welcome-back payload conforms to typed shape

- **GIVEN** previously-flagged person P attends "Sunday Liturgy" on 2026-04-26
- **WHEN** the post-attendance routine resolves the alert and dispatches a `welcome_back` notification to the assigned servant
- **THEN** the `payload` jsonb contains `personId`, `personName='[P first] [P last]'`, `eventTitle='Sunday Liturgy'`, `eventDate='2026-04-26'`
- **AND** the banner and inbox renderers can derive the localized display strings from these fields without additional joins
