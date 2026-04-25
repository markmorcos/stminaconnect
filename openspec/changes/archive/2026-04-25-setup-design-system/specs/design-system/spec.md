# design-system — Spec Delta

## ADDED Requirements

### Requirement: All UI SHALL be built from design system tokens and components.

After this change, any feature phase introducing UI MUST consume colors, typography, spacing, radii, elevations, and motion durations from the tokens defined in `src/design/tokens.ts`. Components MUST come from `src/design/components/`. Ad-hoc color hex codes, font sizes, or spacing values in feature code are prohibited.

#### Scenario: Feature code does not contain literal colors

- **WHEN** a reviewer greps feature code under `src/features/` and `app/` for literal `#` color codes or `rgb(`/`rgba(` declarations
- **THEN** no matches are found except in test fixtures or documented exceptions

#### Scenario: Feature code does not contain literal pixel sizes

- **WHEN** a reviewer greps feature code for hardcoded `padding: 16` or `fontSize: 14` style values
- **THEN** all spacing/typography uses token references (`tokens.spacing.lg`, `tokens.typography.body.size`) or layout primitives (`<Stack gap="lg">`)

### Requirement: Tokens SHALL define light and dark variants for every color.

Every key under `colors.light` MUST have a corresponding key under `colors.dark`. Component theming MUST switch on the active mode without ad-hoc dark-only or light-only overrides at component level.

#### Scenario: Token parity verified

- **WHEN** the unit test for token parity runs
- **THEN** every key in `colors.light` exists in `colors.dark`
- **AND** every key in `colors.dark` exists in `colors.light`

### Requirement: The active theme SHALL respect system setting with optional override.

The `ThemeProvider` MUST resolve the active mode in this order: user override (`AsyncStorage['app.themeMode']` ∈ `'system'|'light'|'dark'`); if the override is `'system'` or absent, the OS-reported color scheme. The override MUST persist across app restarts.

#### Scenario: System dark mode flips app

- **GIVEN** the override is `'system'` (or unset)
- **AND** the device is in dark mode
- **WHEN** the app boots
- **THEN** the dark theme is active
- **WHEN** the user toggles the device to light mode while the app is foregrounded
- **THEN** the app re-renders in the light theme without restart

#### Scenario: Manual override beats system

- **GIVEN** the device is in dark mode
- **AND** the user has selected `'light'` override
- **WHEN** the app boots
- **THEN** the light theme is active

### Requirement: Color pairings SHALL meet WCAG AA contrast.

Every text-on-surface combination defined in `tokens.colors` MUST achieve a contrast ratio of ≥ 4.5:1 for body text (`tokens.typography.body.size`) and ≥ 3:1 for large text (size ≥ 18 OR size ≥ 14 with weight ≥ 700) in both light and dark modes. The `avatarPalette` MUST also pass AA Large for white text.

#### Scenario: Body text contrast verified

- **WHEN** the contrast verification test runs
- **THEN** `text` on `background`, `text` on `surface`, `textInverse` on `primary`, and every other documented pairing yields a ratio ≥ 4.5
- **AND** the test runs for both light and dark variants

### Requirement: Typography SHALL switch font family per active language.

The `Text` component MUST resolve `fontFamily` at render time based on `i18n.language`: Arabic uses IBM Plex Sans Arabic; all other languages use Inter. Both font families MUST be loaded by `expo-font` before the first non-splash render.

#### Scenario: Arabic language renders Arabic font

- **GIVEN** `i18n.language === 'ar'`
- **WHEN** any `Text` component renders
- **THEN** the active `fontFamily` is "IBM Plex Sans Arabic"

#### Scenario: English/German renders Latin font

- **GIVEN** `i18n.language === 'en'` or `'de'`
- **WHEN** any `Text` renders
- **THEN** the active `fontFamily` is "Inter"

#### Scenario: No font flash on cold boot

- **WHEN** the app cold-starts
- **THEN** the splash screen remains visible until fonts have loaded
- **AND** no rendered text frame appears with the system fallback font

### Requirement: A base component library SHALL provide all primitive UI affordances.

The library MUST export at least: `Text`, `Button`, `Input`, `Select`, `Card`, `Avatar`, `Badge`, `Chip`, `IconButton`, `Spinner`, `LoadingSkeleton`, `EmptyState`, `Snackbar`, `Divider`, `Sheet`, `Modal`, `Stack`, `Inline`, `Box`. Each component MUST accept `style`, `accessibilityLabel`, and document its variants in JSDoc.

#### Scenario: All primitives present

- **WHEN** the components index is inspected
- **THEN** the listed components are exported
- **AND** each export has a corresponding test file under `tests/design-system/components/`

### Requirement: All interactive components SHALL meet WCAG touch-target requirements.

`Button`, `IconButton`, `Chip` (interactive), and any other tappable primitive MUST have a minimum hit target of 44 × 44 dp (iOS) / 48 × 48 dp (Android). Hit slop is acceptable to extend tappable area beyond visual size.

#### Scenario: IconButton has 44pt hit target

- **WHEN** a 24pt icon `IconButton` is rendered
- **THEN** the tappable area is at least 44 × 44 dp via padding or hitSlop

### Requirement: Avatar SHALL display initials with a deterministic palette color.

`Avatar` MUST compute its background color by hashing the input identifier (FNV-1a) modulo 8 against `avatarPalette`. Initials are the first letter of `firstName` plus the first letter of `lastName`, Unicode-aware. The text color MUST be `textInverse` for guaranteed contrast (the palette is constructed for white-on-color AA Large).

#### Scenario: Same id yields same color

- **WHEN** `<Avatar id="person-123" firstName="Mariam" lastName="Saad" />` is rendered twice
- **THEN** both render with the same palette color
- **AND** the displayed initials are "MS" (or Arabic equivalent if names are Arabic)

#### Scenario: Different ids tend to yield different colors

- **WHEN** Avatars for 8 different ids are rendered
- **THEN** the distribution across the 8 palette colors is non-trivially varied (best-effort hash distribution)

### Requirement: Layout primitives SHALL use logical properties for RTL correctness.

`Stack`, `Inline`, and `Box` MUST use `marginStart`/`marginEnd`/`paddingStart`/`paddingEnd` rather than `marginLeft`/`marginRight` etc. Every base component MUST render correctly under `I18nManager.isRTL = true`.

#### Scenario: RTL snapshot mirrors LTR appropriately

- **WHEN** a base component snapshot test runs with RTL forced
- **THEN** the snapshot reflects mirrored layout (e.g., a leading icon now appears on the right side in RTL)

### Requirement: A development showcase screen SHALL render every token and variant.

A route at `app/(app)/dev/showcase.tsx` MUST be reachable in dev/preview builds (not in production). The screen MUST display: every color swatch with its token name; the typography scale; the spacing scale; every component variant in light AND dark side-by-side.

#### Scenario: Showcase reachable in dev

- **GIVEN** `__DEV__` is true OR `EXPO_PUBLIC_SHOW_DEV_TOOLS=true`
- **WHEN** the user long-presses the home logo
- **THEN** the showcase route opens

#### Scenario: Showcase not reachable in production

- **GIVEN** a production build (no dev tools env)
- **WHEN** the home logo is long-pressed
- **THEN** nothing happens (and the route is not in the navigator)
