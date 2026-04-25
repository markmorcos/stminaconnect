## Why

The design system locked the visual language; this change locks the brand identity that lives inside it — the app icon, splash screen, logo, and "About" content. We do this immediately after the design system, before any feature screen is built, so every screen is built under real branding rather than placeholder marks.

## What Changes

- **ADDED** capability `branding`.
- **ADDED** Brand brief documented in `docs/branding.md` — visual language references (Coptic crosses, liturgical colors, Byzantine/Coptic typography influence), tone of voice in three languages, "do/don't" examples.
- **ADDED** App icon, designed in line with the brief:
  - Coptic visual language (e.g., a stylized Coptic cross or a glyph-derived mark) — modern execution, not skeuomorphic.
  - 1024 × 1024 PNG source committed under `assets/branding/icon-source.png`.
  - iOS icon configured via `app.json`.
  - Android adaptive icon: foreground 432 × 432 + brand background color.
- **ADDED** Splash screens (light + dark variants):
  - Centered logo + brand background color.
  - Configured via `expo-splash-screen` (compatible with Expo Go for previewing).
  - All required sizes/densities exported to `assets/branding/splash/`.
- **ADDED** `<Logo />` component in `src/design/components/Logo.tsx`:
  - SVG-based via `react-native-svg`.
  - Light + dark variants drawing from theme.
  - Sizes `sm` (24), `md` (40), `lg` (64), `xl` (96).
- **ADDED** Final brand color verification — every text-on-surface pairing in the design-system tokens passes WCAG AA in both modes (recheck after any nudges from initial values).
- **ADDED** Pronunciation/transliteration sheet for "St. Mina":
  - English: "Saint Mina"
  - Arabic: "القديس مينا" (al-Qiddīs Mīnā)
  - German: "St. Mina" (German uses English/Latin name; confirmed via design.md decision §6).
- **ADDED** "About" screen content (`app/(app)/about.tsx`):
  - App name, version, build SHA.
  - Church information and address.
  - Credits (font licenses, icon library, contributors).
  - Acknowledgments to clergy / leadership for v1.
  - Link to privacy policy and terms (real links land in `add-gdpr-compliance`; placeholders here).
- **ADDED** Translation keys `branding.about.*`.
- **MODIFIED** Phase 1's placeholder app icon and splash are replaced with brand assets.
- **MODIFIED** Design system showcase screen now displays the Logo component.

## Impact

- **Affected specs**: `branding` (new). `design-system` is touched indirectly — the Logo component lives under `src/design/components/` to keep the component contract in one place.
- **Affected code**: new `assets/branding/`, new `src/design/components/Logo.tsx`, new `app/(app)/about.tsx`, updated `app.json` icon/splash configuration.
- **Breaking changes**: none — replaces placeholders.
- **Migration needs**: none.
- **Expo Go compatible**: yes — `expo-splash-screen` and `react-native-svg` are bundled with Expo Go.
- **Uses design system**: yes — the Logo component and About screen consume tokens from setup-design-system.
- **Dependencies**: `setup-design-system`.
