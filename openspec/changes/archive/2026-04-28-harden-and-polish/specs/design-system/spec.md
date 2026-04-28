# design-system — Spec Delta

## ADDED Requirements

### Requirement: Animation and motion SHALL respect reduce-motion accessibility setting.

All animations introduced in this change (button press scale, screen transitions, sync indicator pulse, notification banner slide, roster row bounce, skeleton shimmer) MUST honor `AccessibilityInfo.isReduceMotionEnabled()`. When reduce-motion is enabled, transitions MUST fall back to instant changes; loops (pulse, shimmer) MUST be disabled.

#### Scenario: Reduce-motion disables animations

- **GIVEN** the OS reduce-motion accessibility setting is enabled
- **WHEN** any animated component renders
- **THEN** transitions complete in 0ms (or as instant state changes)
- **AND** continuous animations (pulse, shimmer) do not run

#### Scenario: Default state animates normally

- **GIVEN** reduce-motion is OFF
- **WHEN** the user taps a button
- **THEN** the press scale + opacity micro-interaction plays smoothly (≈150ms)

### Requirement: Haptic feedback SHALL fire on documented action types and be user-toggleable.

The `src/utils/haptics.ts` wrapper MUST expose `light()`, `medium()`, `success()`, `warning()`, `error()`. Each call MUST check a user-controlled toggle (Settings → Accessibility → Haptics, default on); when off, calls MUST be no-ops. Wirings MUST exist for: roster row toggle (`light`), Quick Add submit success (`success`), follow-up complete (`medium`), notification banner appear (`light`), destructive confirmation enabled (`warning`), sync 4xx error (`error`).

#### Scenario: Haptics toggle off silences feedback

- **GIVEN** the user has disabled haptics in Settings → Accessibility
- **WHEN** any haptic-triggering action fires
- **THEN** no haptic feedback occurs on the device
- **AND** no error is thrown

#### Scenario: Default settings produce haptics

- **GIVEN** default haptics setting (on)
- **WHEN** the user toggles a roster row
- **THEN** a light impact haptic fires

### Requirement: Empty states SHALL display a localized icon, title, body, and optional CTA.

`EmptyState` consumers MUST pass `iconName` (lucide), localized `title` and `body` keys, and an optional `cta` button. The component MUST render the icon at 48pt above the title (`headingMd`) and body (`body`), centered horizontally with adequate vertical padding. Reuse across persons list, follow-ups, today's events, notifications inbox, and roster MUST be the standard pattern.

#### Scenario: Empty persons list displays themed empty state

- **GIVEN** the persons list returns zero rows
- **WHEN** the screen renders
- **THEN** an `EmptyState` displays with icon `users`, title `t('persons.list.emptyTitle')`, body `t('persons.list.emptyBody')`
- **AND** the rendering is themed (light or dark) appropriately
