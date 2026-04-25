# Tasks — setup-design-system

## 1. Tokens

- [ ] 1.1 Create `src/design/tokens.ts` exporting literal `colors.light`, `colors.dark`, `typography`, `spacing`, `radii`, `elevation`, `motion`, and `avatarPalette` per `design.md` §3, §5.
- [ ] 1.2 Unit test: every light color key has a dark counterpart of the same name.
- [ ] 1.3 Unit test: `avatarPalette` has exactly 8 entries; each passes WCAG AA Large against white text (calc via a small contrast helper).

## 2. Theme + provider

- [ ] 2.1 `src/design/theme.ts`: function `buildPaperTheme(mode: 'light' | 'dark')` returning a Paper `MD3Theme` populated from tokens.
- [ ] 2.2 `src/design/ThemeProvider.tsx`:
  - Reads `useColorScheme()` for system default.
  - Reads `AsyncStorage['app.themeMode']` for override.
  - Resolves active mode (`system` → use system; otherwise the override).
  - Mounts Paper's `<PaperProvider>` with the built theme.
  - Provides a context with `{ mode, setMode, isDark, tokens }`.
- [ ] 2.3 Hooks `useTheme()`, `useTokens()`, `useThemeMode()`.
- [ ] 2.4 Mount provider in `app/_layout.tsx` outside the existing splash-hold logic.

## 3. Fonts

- [ ] 3.1 Download Inter (Regular 400, Medium 500, SemiBold 600, Bold 700) and IBM Plex Sans Arabic (same weights). Store under `assets/fonts/`.
- [ ] 3.2 Configure `expo-font.useFonts` in `app/_layout.tsx`. Block render until ready.
- [ ] 3.3 Configure `expo-splash-screen` to keep the splash visible until fonts + theme are ready, then `SplashScreen.hideAsync()`.

## 4. Icon system

- [ ] 4.1 `npm install lucide-react-native`.
- [ ] 4.2 `src/design/Icon.tsx`: thin wrapper accepting `name` (string keys for the icons we use), `size` (defaults to `lg = 24`), and `color` (defaults to `tokens.text`). Re-exports curated subset of icons by name to keep bundle small.
- [ ] 4.3 Document the curated icon list at the top of `Icon.tsx` — additions must come via PR, not inline imports.

## 5. Base components

- [ ] 5.1 `Text` — variants tied to `tokens.typography`; resolves font family per `i18n.language`.
- [ ] 5.2 `Button` — variants `primary`/`secondary`/`ghost`/`destructive`; sizes `sm`/`md`/`lg`. Hit target ≥ 44pt for `md`/`lg`. Loading state.
- [ ] 5.3 `Input` — label, helper, error props; focus ring. Wraps Paper `TextInput` with our theme.
- [ ] 5.4 `Select` / `Picker` — Paper `Menu` based with token-aware styling.
- [ ] 5.5 `Card` — Surface with `tokens.elevation.sm` default, `lg` rounded corners.
- [ ] 5.6 `Avatar` — initials + deterministic color from `avatarPalette` via FNV-1a hash. Sizes `sm` (32), `md` (40), `lg` (56).
- [ ] 5.7 `Badge` — variants `neutral`/`success`/`warning`/`error`/`info`/`priorityHigh`/`priorityMedium`/`priorityLow`/`priorityVeryLow`. Used for streak status colors and priority chips.
- [ ] 5.8 `Chip` — single-select / multi-select; `selected` prop.
- [ ] 5.9 `IconButton` — wraps `Icon` + `Pressable` with hit slop to 44pt.
- [ ] 5.10 `Spinner`, `LoadingSkeleton` — token-driven shimmer/animation (animation lands in `harden-and-polish`; static bars here).
- [ ] 5.11 `EmptyState` — icon + title (`headingMd`) + body (`body`) + optional CTA Button.
- [ ] 5.12 `Toast` / `Snackbar` — Paper-backed with our theme.
- [ ] 5.13 `Divider` — subtle border-color line.
- [ ] 5.14 `Sheet` / `BottomSheet` — wrapping Paper `Modal` with grab-handle styling.
- [ ] 5.15 `Modal` — Paper `Modal` themed.
- [ ] 5.16 Layout primitives: `Stack` (vertical), `Inline` (horizontal), `Box` (sized container) with `padding`/`margin`/`gap` props mapped to spacing tokens.
- [ ] 5.17 Every component exports a `*Props` type and is barrel-exported from `src/design/components/index.ts`.

## 6. Showcase screen

- [ ] 6.1 `app/(app)/dev/showcase.tsx`. Tabs/sections: Tokens, Components, Light/Dark toggle.
- [ ] 6.2 Hidden by default; reachable via long-press on the home logo when `__DEV__` or `EXPO_PUBLIC_SHOW_DEV_TOOLS=true`.

## 7. Restyle the placeholder screen

- [ ] 7.1 Replace phase 1's home with `Stack` + `Text` (variant `headingLg`) using design system tokens.
- [ ] 7.2 Verify visually in light + dark.

## 8. Tests

- [ ] 8.1 Unit: `tokens.ts` shape integrity (key parity light/dark; types).
- [ ] 8.2 Unit: avatar color hash produces deterministic indexes for known IDs.
- [ ] 8.3 Snapshot: every base component rendered in light + dark + RTL (3 × 16 = 48 snapshots; commit them).
- [ ] 8.4 Component: `ThemeProvider` returns correct mode after `setMode` call; persists to AsyncStorage.
- [ ] 8.5 Visual: a manual screenshot baseline of the showcase screen captured to `docs/design-system/baseline-{light,dark}.png` (committed for human-eye review on future changes).

## 9. Documentation

- [ ] 9.1 Short README at `src/design/README.md`: how to consume tokens, when to add a new component, when to file a token gap.
- [ ] 9.2 Inline JSDoc on each component listing variants and a11y notes.

## 10. Verification (in Expo Go)

- [ ] 10.1 Cold app boot — splash held until fonts+theme ready; no flash.
- [ ] 10.2 System dark mode toggle on phone changes app appearance.
- [ ] 10.3 Settings → Theme override (manual radio test surface during this phase) — light/dark/system all work.
- [ ] 10.4 Showcase screen renders all variants; readable contrast in both themes.
- [ ] 10.5 RTL: temporarily force `I18nManager.forceRTL(true)` + reload — every component lays out correctly.
- [ ] 10.6 `make test` and `make typecheck` clean.
- [ ] 10.7 `openspec validate setup-design-system` passes.
