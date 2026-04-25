## Context

Phase 1 stood up the toolchain with a placeholder screen. Before any feature lands, we lock the visual language — colors, typography, spacing, components — so feature phases consume tokens instead of inventing them. The brand identity for St. Mina Connect is Coptic Orthodox tradition expressed through a contemporary mobile aesthetic: liturgical reds, vestment golds, warm neutrals; humanist sans-serif Latin paired with a high-quality Arabic family; clean and readable, never skeuomorphic or "churchy."

This is the second-most architecturally consequential phase after offline sync — every screen built later assumes this exists.

## Goals

- One token vocabulary used everywhere.
- Light + dark themes from day one.
- RTL fully tested at the component level (not just at the screen level).
- WCAG AA contrast verified for every color pairing.
- A small, focused component library (≤ 20 components) that covers 95% of UI needs.
- Fonts load fast and predictably; no font-flash on a cold app open.
- The aesthetic carries Coptic identity without resorting to literal church imagery.

## Non-Goals

- A full Material 3 implementation. Paper is a substrate, not the visual layer.
- Animation library setup — that's `harden-and-polish`.
- Production icons and splash — that's `add-brand-assets`.
- A web design system. Mobile-only for v1.
- Component-level Storybook tooling (heavy install). The dev showcase screen is enough.
- Cross-app theme sharing (no second app exists).

## Decisions

1. **Substrate: React Native Paper, theme overridden.** Paper retained because:
   - Industry-best a11y defaults (focus rings, screen-reader hooks, hit-target enforcement).
   - Excellent RTL support (uses logical `start`/`end` internally).
   - Bundled in Expo Go.
   - Well-documented and stable.

   But Paper's Material 3 colors and Roboto-default typography are too generic. Our `theme.ts` overrides Paper's full palette with our `tokens.colors`, switches Paper's typography variants to use our font families, and provides a custom shape system. The result: Paper components use our brand visuals while keeping Paper's a11y wiring.

2. **Tokens are pure data.** `src/design/tokens.ts` exports literal values; no React, no Paper imports. This keeps tokens testable in isolation and lets us regenerate Paper themes deterministically.

3. **Color palette (initial values; iterated in `add-brand-assets`):**
   ```ts
   light: {
     primary:        '#8B1E2D',  // deep liturgical red
     primaryMuted:   '#B85565',
     secondary:      '#C9A961',  // warm gold
     accent:         '#445A8A',  // muted indigo (info/links)
     background:     '#FBF8F4',  // warm off-white
     surface:        '#FFFFFF',
     surfaceElevated:'#FFFFFF',
     text:           '#1C1A18',
     textMuted:      '#5C544D',
     textInverse:    '#FBF8F4',
     border:         '#E5DED5',
     success:        '#2E7D52',
     warning:        '#B45309',
     error:          '#B0263C',
     info:           '#445A8A',
   }
   dark: {
     primary:        '#D45D6E',  // lifted from light primary for dark-bg contrast
     primaryMuted:   '#7A2A37',
     secondary:      '#E2BE7A',
     accent:         '#7A8DC4',
     background:     '#15110E',
     surface:        '#1F1A16',
     surfaceElevated:'#2A231D',
     text:           '#F5EFE7',
     textMuted:      '#B5ABA0',
     textInverse:    '#1C1A18',
     border:         '#3A322A',
     success:        '#5BB387',
     warning:        '#E0A85C',
     error:          '#E47388',
     info:           '#7A8DC4',
   }
   ```
   These are starting values. `add-brand-assets` runs the WCAG verification and may nudge values 5–10% to hit AA against text pairings. The `avatarPalette` is 8 saturation-balanced colors derived from the primary/secondary/accent — chosen so that white text on any of them passes AA Large.

4. **Typography pairing rationale**:
   - **Inter** (Latin) — humanist sans-serif, excellent at small sizes, neutral enough not to compete with the brand colors. Free, OFL-licensed, ships from Google Fonts.
   - **IBM Plex Sans Arabic** — same designer family ethos as Inter (rationalist, friendly), purpose-built Arabic glyph design, excellent kerning at all sizes. Free.
   - The two pair visually because they share design principles (humanist, geometric balance) without being identical — appropriate for a trilingual app where the Arabic shouldn't feel like a translation afterthought.
   - We do NOT use Cairo or Tajawal: too geometric, less reading rhythm at body sizes.

5. **Typography scale (sizes in dp; line-height as multiplier):**
   ```
   displayLg : 32 / 1.2 / 700
   displayMd : 28 / 1.25 / 700
   headingLg : 22 / 1.3 / 600
   headingMd : 18 / 1.35 / 600
   headingSm : 16 / 1.4 / 600
   bodyLg    : 16 / 1.5 / 400
   body      : 14 / 1.5 / 400
   bodySm    : 13 / 1.45 / 400
   caption   : 12 / 1.4 / 500
   label     : 12 / 1.3 / 600 (uppercase tracking +0.5)
   ```
   The `Text` component picks font family at render time based on `i18n.language === 'ar'` → IBM Plex Sans Arabic; otherwise Inter.

6. **Dark mode strategy**:
   - System default via `useColorScheme()` (RN core hook; Expo Go-compatible).
   - User override stored at `app.themeMode` ∈ `'system' | 'light' | 'dark'`.
   - Settings → Theme is a tri-radio. The override is read at app boot and applied before first render to avoid a light-flash on dark devices.

7. **RTL strategy**:
   - Paper handles direction internally for built-in components.
   - Our custom layout primitives (`Stack`, `Inline`, `Box`) use logical properties: `marginStart`/`marginEnd` (RN supports these directly).
   - Tests render every base component with `I18nManager.forceRTL(true)` mocked and snapshot the layout.

8. **Icon library: `lucide-react-native`.**
   - Stroke-style icons pair cleanly with brand sans-serif typography.
   - Tree-shakable.
   - Active maintenance, comprehensive set.
   - Expo Go compatible (no native modules — uses `react-native-svg` which is bundled).

9. **Avatar component**: deterministic color via `colorIndex = hash(personId) mod 8` where `hash` is a fast non-cryptographic FNV-1a. The 8 palette colors are defined in tokens. Initials are first-letter-of-first-name + first-letter-of-last-name (Unicode-aware — works for Arabic). Photos are explicitly not in v1.

10. **Showcase screen**: `app/(app)/dev/showcase.tsx`, hidden in production builds via env check (`__DEV__` or `process.env.EXPO_PUBLIC_SHOW_DEV_TOOLS`). Sections: Tokens (color swatches, type scale, spacing scale, radii, shadows), Components (every variant of every component), Light/Dark side-by-side toggle.

11. **Font loading**: `expo-font.useFonts` returns a boolean ready flag; the `app/_layout.tsx` blocks rendering with the splash screen visible until fonts are loaded. Splash is auto-shown by `expo-splash-screen` on cold start; we call `SplashScreen.hideAsync()` only after fonts + theme are ready. This eliminates font-flash.

12. **Component API conventions**:
   - All variants exposed via `variant` prop (string union).
   - All components accept `style` and forward to the outermost element.
   - All components accept and forward `accessibilityLabel`.
   - Components do not accept color or font-family as props — they read from tokens. If a screen needs an off-token color, that's a token gap to file as a design-system follow-up, not a one-off.

## Risks / Trade-offs

- **Risk**: Paper theme override is extensive. Changes in Paper's internal component theming surface could break us. Mitigation: pin Paper version; theme override tested via component snapshot tests.
- **Risk**: 2 font families × 2 styles = 4 binary font files in the bundle (~400KB). Acceptable.
- **Risk**: dark mode color drift from light. Mitigation: every light token has an explicit dark counterpart; the `add-brand-assets` phase runs WCAG verification on every pairing.
- **Trade-off**: not adopting NativeWind/Tamagui. Reasoning: Paper's a11y/RTL/Expo-Go-compatibility wins outweigh styling-system ergonomics for a solo dev who values shipping over flexibility.
- **Risk**: solo dev iterating on tokens during feature builds means frequent re-snapshotting of component tests. Acceptable cost.

## Migration Plan

- New folder `src/design/`. New `assets/fonts/` (filled by tasks).
- `app/_layout.tsx` wraps with `<ThemeProvider>`. Existing placeholder screen is restyled.
- No DB or sync impact.

## Open Questions

- Final hex values may shift in `add-brand-assets` after WCAG verification. The architecture (token shape, component API) is locked here.
