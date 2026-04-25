# Tasks — add-brand-assets

## 1. Brand brief

- [ ] 1.1 Write `docs/branding.md`: visual references, palette philosophy, typography pairing rationale, do/don't examples, tone of voice in EN/AR/DE.
- [ ] 1.2 Document the cross-glyph concept with sketches/SVG in `docs/branding.md`.

## 2. App icon

- [ ] 2.1 Design the icon glyph as SVG. Commit to `assets/branding/icon.svg`.
- [ ] 2.2 Render to 1024 × 1024 PNG → `assets/branding/icon-source.png`.
- [ ] 2.3 Render adaptive foreground 432 × 432 (transparent bg) → `assets/branding/icon-foreground.png`.
- [ ] 2.4 Configure `app.json`:
  - `expo.icon = "./assets/branding/icon-source.png"`
  - `expo.android.adaptiveIcon = { foregroundImage: "./assets/branding/icon-foreground.png", backgroundColor: "<primary>" }`
  - `expo.ios.icon = "./assets/branding/icon-source.png"`
- [ ] 2.5 Visually verify the icon on iOS and Android home screens via Expo Go's Recent Projects view (where applicable) and a dev client.

## 3. Splash screen

- [ ] 3.1 Compose splash as logo on background. Render light + dark to PNG at 1284 × 2778:
  - `assets/branding/splash-light.png`
  - `assets/branding/splash-dark.png`
- [ ] 3.2 Configure `expo-splash-screen` in `app.json`:
  - `expo.splash = { image: "./assets/branding/splash-light.png", resizeMode: "contain", backgroundColor: "<background-light>" }`
  - `expo.userInterfaceStyle = "automatic"` (allows dark splash via Expo's split-image rules where supported).
- [ ] 3.3 Hide splash only after fonts + theme + initial auth check are ready (extends phase-2's pattern).

## 4. Logo component

- [ ] 4.1 Create `src/design/components/Logo.tsx` using `react-native-svg`. Variants `mark` and `combined`. Sizes `sm`/`md`/`lg`/`xl`. Reads colors from `useTokens()`.
- [ ] 4.2 Snapshot tests for each variant × size in light + dark + RTL.
- [ ] 4.3 Add Logo to the design-system showcase screen.

## 5. WCAG verification

- [ ] 5.1 Helper `src/design/utils/contrast.ts`: relative-luminance and WCAG ratio calc.
- [ ] 5.2 `tests/branding/contrast.test.ts`: walks every documented pairing in `tokens.colors.light` and `tokens.colors.dark`. Fails on any sub-AA pairing.
- [ ] 5.3 If any pairing fails: nudge the offending token value 5–10% and re-run. Final values committed in `src/design/tokens.ts`.

## 6. App name + transliteration

- [ ] 6.1 Update `app.json`:
  - `expo.name = "St. Mina Connect"`
  - `expo.slug = "st-mina-connect"`
- [ ] 6.2 Add `branding.appName.{en,ar,de}` to all locale files with the resolved values.
- [ ] 6.3 Document pronunciation in `docs/branding.md` § Naming.

## 7. About screen

- [ ] 7.1 `src/branding/church.ts`: church name, address, languages spoken, contact, leadership credits (with opt-in flag per individual).
- [ ] 7.2 `app/(app)/about.tsx`:
  - App identity section (name, version from `Constants.expoConfig.version`, build SHA if available).
  - Church section (read from `church.ts`).
  - Credits section (font licenses, icon library, library credits).
  - Privacy / Terms placeholder links (real URLs land in `add-gdpr-compliance`).
  - Long-press App identity to reveal showcase route in dev builds.
- [ ] 7.3 Translation keys `branding.about.*`: title, app, church, credits, privacy, terms, version, buildSha.

## 8. Translations

- [ ] 8.1 Extend `en.json` / `ar.json` / `de.json`:
  - `branding.appName`
  - `branding.about.*`

## 9. Tests

- [ ] 9.1 Snapshot Logo light/dark/RTL variants.
- [ ] 9.2 Contrast suite passes for every pairing.
- [ ] 9.3 Component test: About screen renders all sections; long-press in dev navigates to showcase.

## 10. Verification (in Expo Go)

- [ ] 10.1 Cold app boot — splash shows brand background + logo; transitions cleanly to home (no blank flash).
- [ ] 10.2 Toggle device dark mode → next splash uses dark variant (where supported by Expo).
- [ ] 10.3 Open About → all sections render; version pulled correctly.
- [ ] 10.4 Switch to AR → app name reads "خدمة القديس مينا" everywhere.
- [ ] 10.5 Switch to DE → app name remains "St. Mina Connect".
- [ ] 10.6 Showcase screen now displays Logo variants.
- [ ] 10.7 `make test` clean; contrast suite green.
- [ ] 10.8 `openspec validate add-brand-assets` passes.
