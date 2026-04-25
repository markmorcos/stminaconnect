# design-system — Spec Delta

## MODIFIED Requirements

### Requirement: A base component library SHALL provide all primitive UI affordances.

The component library MUST export the primitives listed in `setup-design-system` (Text, Button, Input, Avatar, Badge, etc.). From this change forward, the index MUST also export `Logo`, defined in `src/design/components/Logo.tsx`. The Logo component MUST be theme-aware (light/dark) and MUST consume the same tokens as other primitives — it MUST NOT introduce its own color or sizing literals.

#### Scenario: Logo present in component index

- **WHEN** the components barrel index is inspected
- **THEN** `Logo` is exported alongside the other primitives listed in `setup-design-system`
- **AND** importing `Logo` from the design-system path resolves without error

#### Scenario: Logo respects active theme

- **GIVEN** the active theme is light
- **WHEN** `<Logo size="lg" />` renders
- **THEN** the SVG uses `tokens.colors.light.primary` and `tokens.colors.light.secondary`

- **GIVEN** the active theme is dark
- **WHEN** the same Logo renders
- **THEN** the SVG uses `tokens.colors.dark.primary` and `tokens.colors.dark.secondary`
