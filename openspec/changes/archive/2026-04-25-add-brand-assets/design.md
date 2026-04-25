## Context

The design system established visual primitives. The brand makes those primitives belong to St. Mina Connect specifically. With the design system locking colors and typography, the brand layer focuses on identity assets: icon, splash, logo, naming, About content. We deliberately keep this lightweight — solo dev, not a marketing exercise — but every asset gets WCAG and quality verification because they ship to real devices.

## Goals

- An app icon that is recognizable on a home screen full of icons, evokes Coptic Orthodox identity without being literal church imagery.
- A splash screen that doesn't feel like a third-party template.
- A logo component the rest of the app can use anywhere (header, About, Sign-in).
- Brand colors verified for accessibility AFTER seeing them on real devices.
- Pronunciation guidance for the multilingual audience.

## Non-Goals

- A full brand book or marketing site.
- Photography or illustration assets (no photos in v1; illustrations are deferred to `harden-and-polish` if needed).
- Animated splash. Static suffices.
- Multiple brand variants (we have one).
- Trademark registration. Out of v1.

## Decisions

1. **Icon concept**: a stylized Coptic cross expressed as a single, modern glyph — slightly geometric, avoiding photo-realistic religious iconography. Background uses `tokens.colors.light.primary` (deep liturgical red); the glyph uses `tokens.colors.light.secondary` (warm gold). Same shape, swapped colors for the dark variant.
2. **Why a cross-derived mark, not a person/place name**: a cross is universally recognizable to the audience and culture-specific. Mariam, Mina (the saint), and clergy will read the symbol immediately; non-Coptic Munich users see a cross and understand. Avoids text-only icons that don't survive Android adaptive icon scaling.
3. **Adaptive icon (Android)**: foreground is the cross glyph on a transparent background; background is `tokens.colors.light.primary`. Foreground stays inside the safe zone (66dp circle inscribed in 108dp). Verified on round, square, squircle, and teardrop masks.
4. **Splash composition**: centered Logo (`lg` size) + brand background. Light variant: cream background (`tokens.colors.light.background`) with the colored logo. Dark variant: dark surface (`tokens.colors.dark.background`) with light-mode logo colors lifted for contrast.
5. **Logo component shape**: same glyph as the icon, available as SVG so it scales without artifacts. Three layers: outer cross silhouette, optional inner accent stroke, optional small "M" mark below for combined-mark variant. Component prop `variant: 'mark' | 'combined'` defaults to `'mark'` (just the glyph).
6. **App name displays** (resolves the open question on German):
   - English UI: "St. Mina Connect"
   - Arabic UI: "خدمة القديس مينا" — literally "Service of Saint Mina" — chosen because "Connect" is a hard word to translate idiomatically; "خدمة" (servanthood/service) carries the pastoral meaning natively.
   - German UI: "St. Mina Connect" — keep English. German Coptic communities commonly use the English transliteration in print and signage; introducing a German rendering would feel imposed.
7. **WCAG verification approach**:
   - Build a small `tests/branding/contrast.test.ts` that walks every documented text-on-surface pairing.
   - For each pairing in light and dark modes, compute contrast ratio using a relative-luminance formula.
   - Fail the test if any pairing < 4.5 (body) or < 3.0 (large).
   - This formalizes the design system's WCAG goal at the brand-locking moment.
8. **Brand colors as final**: at the end of this change, the token values from setup-design-system are either confirmed or nudged 5–10%. Subsequent phases treat the tokens as immutable contract.
9. **About screen scope**:
   - Read-only.
   - Sections: app info, church info, credits.
   - Church info pulled from a static config (`src/branding/church.ts`) — name, address, language hours, primary email/phone.
   - "Built by" credit line; explicit acknowledgments to seeded data subjects (e.g., the parish priest who allowed beta testing) — opt-in via config flag.
10. **Splash flicker prevention**: continue the pattern from setup-design-system — splash hides only after fonts AND theme AND first auth check are ready. Brand-locked splash makes the cold-start feel deliberate, not blank.
11. **Asset delivery format**:
    - App icon: 1024 × 1024 PNG source; Expo handles platform resizing during build.
    - Adaptive icon foreground: 432 × 432 PNG with transparency.
    - Splash: 1284 × 2778 PNG light + dark (iPhone 14 Pro Max bound). Expo's resize mode `contain` handles other devices.
    - Logo: SVG (committed as JSX in `Logo.tsx`).
12. **Acknowledgments + credits**: licenses for Inter, IBM Plex Sans Arabic, lucide-react-native, react-native-paper listed inline on About — required by their licenses (OFL, MIT, etc.).

## Risks / Trade-offs

- **Risk**: a custom-designed icon adds design effort. Mitigation: solo dev sketches a v1 internally; can be replaced via a simple asset swap if the church's leadership later wants to commission something more elaborate.
- **Risk**: gold (`#C9A961`) on red (`#8B1E2D`) is iconic but may not pass AA contrast as a fine-detail accent. Mitigation: the icon glyph uses gold at large sizes only (always ≥ 18dp on a phone home screen); fine-detail uses cream/white instead.
- **Trade-off**: keeping "St. Mina Connect" in German is a pragmatic call that avoids translating "Connect" awkwardly. Documented and reversible.
- **Risk**: religious iconography on app icons has been flagged by some store reviewers. Mitigation: cross-derived modern glyph passes prior-art review by looking like a contemporary geometric mark; documented in the store-readiness phase if escalation is ever needed.

## Migration Plan

- Replace placeholder icon and splash from phase 1.
- Add Logo component, About screen.
- Update tokens if WCAG verification flags any pairing.

## Open Questions

- None blocking. Logo design iteration may continue post-launch but the asset slot is locked.
