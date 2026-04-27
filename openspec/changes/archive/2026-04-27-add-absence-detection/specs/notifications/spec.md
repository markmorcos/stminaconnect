# notifications — Spec Delta

## MODIFIED Requirements

### Requirement: A `notifications` table SHALL store every dispatched notification.

The `notifications` table MUST persist every dispatched notification. From this change forward, `absence_alert` rows MUST carry a structured payload containing `personId`, `personName`, `consecutiveMisses`, `lastEventTitle`, `lastEventDate`, `priority`, and `thresholdKind`. The `notifications` schema itself is unchanged; this is an additive contract on the `payload jsonb` column for the `absence_alert` type.

#### Scenario: Absence-alert payload conforms to the typed shape

- **GIVEN** absence detection fires for person P with 3 consecutive misses at "Sunday Liturgy" on 2026-04-26
- **WHEN** `dispatch_notification` inserts the row
- **THEN** the `payload` jsonb contains `personId`, `personName='[P first] [P last]'`, `consecutiveMisses=3`, `lastEventTitle='Sunday Liturgy'`, `lastEventDate='2026-04-26'`, `priority`, `thresholdKind='primary'`
- **AND** any consumer (banner, inbox, push) can read these fields without additional joins
