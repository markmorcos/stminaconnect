## Why

We're building a brand-led app for a specific community (Coptic Orthodox in Munich) — generic Material defaults will fight the brand at every screen. Establishing the design system before any feature screen means every later phase consumes tokens, not invents them. It also unblocks a coherent dark mode, real RTL, and a consistent accessibility baseline.

## What Changes

- **ADDED** capability `design-system`.
- **ADDED** themed React Native Paper as the substrate, configured with brand-led tokens (light + dark) — Paper retained for its accessibility wins; we override its theme entirely so the visual identity is ours, not Material's.
- **ADDED** Design tokens (light + dark variants for every value):
  - **Colors**: `primary`, `primaryMuted`, `secondary`, `accent`, `background`, `surface`, `surfaceElevated`, `text`, `textMuted`, `textInverse`, `border`, `success`, `warning`, `error`, `info`. Plus `avatarPalette` — array of 8 background colors with WCAG-checked contrast against white text.
  - **Typography scale**: `displayLg`, `displayMd`, `headingLg`, `headingMd`, `headingSm`, `bodyLg`, `body`, `bodySm`, `caption`, `label` — each with size, line-height, weight; separate font-family resolution for Latin vs Arabic.
  - **Spacing scale**: `0`, `xs (4)`, `sm (8)`, `md (12)`, `lg (16)`, `xl (24)`, `2xl (32)`, `3xl (48)`, `4xl (64)`.
  - **Radii**: `sm (4)`, `md (8)`, `lg (12)`, `xl (16)`, `full (9999)`.
  - **Elevation**: `none`, `sm`, `md`, `lg` — paired iOS shadow and Android elevation values.
  - **Motion**: `durationFast (150ms)`, `durationBase (250ms)`, `durationSlow (400ms)` plus easing curves.
- **ADDED** `ThemeProvider` with light/dark/system modes; persisted user override at AsyncStorage key `app.themeMode`.
- **ADDED** Hooks: `useTheme()`, `useTokens()`, `useColorScheme()`.
- **ADDED** Base component library on top of Paper + RN primitives:
  - `Text` (variant prop tied to typography scale).
  - `Button` (variants `primary`, `secondary`, `ghost`, `destructive`; sizes `sm`, `md`, `lg`).
  - `Input` (label, error, helper).
  - `Select` / `Picker`.
  - `Card`.
  - `Avatar` (initials + deterministic color from `avatarPalette`).
  - `Badge` (priority labels, status pills, streak indicators).
  - `Chip`.
  - `IconButton`.
  - `Spinner` / `LoadingSkeleton`.
  - `EmptyState` (icon + message + optional CTA).
  - `Toast` / `Snackbar` (Paper-backed with our tokens).
  - `Divider`.
  - `Sheet` / `BottomSheet`.
  - `Modal`.
  - Layout primitives: `Stack`, `Inline`, `Box`.
- **ADDED** Icon system: `lucide-react-native` (Expo Go compatible, stroke-style modern aesthetic that pairs cleanly with the brand).
- **ADDED** Custom fonts via `expo-font`:
  - Latin (EN/DE): **Inter** (open-source, excellent legibility, comprehensive Latin coverage).
  - Arabic: **IBM Plex Sans Arabic** (visually paired family, excellent Arabic typography, free).
- **ADDED** Hidden-in-prod design system showcase screen (`/dev/showcase`) browseable in dev builds — shows every token + every component variant.
- **ADDED** All base components have unit tests covering variants, dark mode, and RTL rendering.
- **ADDED** `tokens` package: a single `src/design/tokens.ts` exporting the literal token values; theme provider transforms these into Paper's theme shape.

## Impact

- **Affected specs**: `design-system` (new).
- **Affected code**: new `src/design/{tokens.ts, theme.ts, ThemeProvider.tsx, hooks/, components/}`. New `assets/fonts/`. Updated `app/_layout.tsx` to mount the theme provider and load fonts. Updated `app.json` for font assets.
- **Breaking changes**: none — first time these tokens exist; the placeholder home screen from phase 1 is restyled but its behavior is unchanged.
- **Migration needs**: none.
- **Expo Go compatible**: yes — Paper, expo-font, lucide-react-native, AsyncStorage, and `useColorScheme` all work in Expo Go. Reanimated (used later in `harden-and-polish`) is also Expo Go-compatible from SDK 50+.
- **Uses design system**: this *is* the design system. Establishes the contract every later phase honours.
- **Dependencies**: `init-project-scaffolding`.
