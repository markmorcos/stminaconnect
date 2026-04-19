## MODIFIED Requirements

### Requirement: Streak computation over counted events

For any active person whose `on_break` is false, OR whose `on_break_until` is in the past, the system SHALL compute "absence streak" as defined previously. For persons with `on_break = true AND on_break_until >= today`, detection SHALL skip them entirely: no streak, no alert.

#### Scenario: On-break person skipped

- **GIVEN** Maria has `on_break = true, on_break_until = 2026-05-15`; today is 2026-04-19
- **WHEN** detection runs
- **THEN** no alert is created for Maria regardless of her streak

#### Scenario: Break expired, detection resumes

- **GIVEN** Maria's `on_break_until = 2026-04-18`; today is 2026-04-19
- **WHEN** detection runs
- **THEN** Maria is processed normally

### Requirement: Alert resolution on return

When an attendance row is inserted for a counted event and an `open` alert exists for that person, the alert's status SHALL atomically become `resolved` with `resolved_at = now()`, and a return-detection notification SHALL be dispatched.

#### Scenario: Return resolves alert

- **GIVEN** Maria has an open alert assigned to servant A
- **WHEN** she is marked present at today's counted event
- **THEN** the alert status becomes `resolved`
- **AND** `push-dispatch` is invoked with `kind = 'return'`
- **AND** servant A's devices receive the return push
