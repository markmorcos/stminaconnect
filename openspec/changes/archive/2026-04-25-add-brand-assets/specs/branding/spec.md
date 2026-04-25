# branding — Spec Delta

## ADDED Requirements

### Requirement: An app icon SHALL be configured for both platforms.

The app icon MUST be a custom-designed mark expressing Coptic Orthodox visual language. A 1024 × 1024 PNG source MUST be configured for iOS, and an adaptive icon (foreground + background color) MUST be configured for Android. Both MUST be visible on a real device home screen post-build.

#### Scenario: iOS icon visible

- **GIVEN** a build is installed on iOS
- **WHEN** the user views the home screen
- **THEN** the St. Mina Connect icon appears with the cross-glyph mark on the brand background

#### Scenario: Android adaptive icon survives masking

- **GIVEN** a build is installed on Android
- **WHEN** the home screen renders the icon under any of the four standard mask styles (round, square, squircle, teardrop)
- **THEN** the cross glyph remains fully visible inside the safe zone
- **AND** the brand background fills the masked area

### Requirement: Splash screens SHALL render light and dark brand variants.

The app's splash screen MUST display the centered logo on the brand background. Light and dark variants MUST exist; the active variant MUST follow the device color scheme where Expo supports it. The splash MUST remain visible until fonts, theme, and initial auth check are ready — preventing any blank-flash on cold start.

#### Scenario: Cold start shows brand splash

- **GIVEN** the app has been killed
- **WHEN** the user reopens the app
- **THEN** a brand-themed splash with the logo appears
- **AND** the splash remains until the app is ready to render the home or sign-in screen

#### Scenario: Dark device gets dark splash

- **GIVEN** the device is in dark mode and the OS supports per-mode splash assets
- **WHEN** the app cold-starts
- **THEN** the dark splash variant is shown

### Requirement: A Logo component SHALL be available throughout the app.

`src/design/components/Logo.tsx` MUST export a configurable Logo component supporting:

- variants `mark` (glyph only) and `combined` (glyph + wordmark);
- sizes `sm` (24), `md` (40), `lg` (64), `xl` (96);
- automatic light/dark color resolution via the active theme;
- correct rendering under RTL (the cross is symmetric so visually identical; component still respects logical layout for the combined variant).

#### Scenario: Logo renders at all sizes in both themes

- **WHEN** the design system showcase displays the Logo at all four sizes in light and dark mode
- **THEN** each rendering uses the correct theme colors and is visually crisp at the target dp

#### Scenario: Combined variant flips correctly under RTL

- **WHEN** the combined variant is rendered with `I18nManager.isRTL=true`
- **THEN** the wordmark layout adjusts via logical properties (no awkward overlap with the glyph)

### Requirement: Brand color tokens SHALL pass WCAG AA contrast for every documented pairing.

After this change, the design system tokens MUST satisfy WCAG AA contrast for every text-on-surface pairing in both light and dark modes. The `avatarPalette` MUST satisfy AA Large for white text. A Jest test MUST enforce this.

#### Scenario: Contrast suite green

- **WHEN** `tests/branding/contrast.test.ts` runs
- **THEN** every pairing in the suite returns ratio ≥ 4.5 for body text and ≥ 3.0 for large text
- **AND** every avatar palette color returns ratio ≥ 3.0 against white text

### Requirement: The app name SHALL render correctly in each locale.

The displayed app name MUST resolve from `t('branding.appName')`:

- English: "St. Mina Connect"
- Arabic: "خدمة القديس مينا"
- German: "St. Mina Connect"

The native bundle name (`expo.name` in `app.json`) is "St. Mina Connect" — this is what appears on the device home screen.

#### Scenario: Arabic UI shows Arabic app name

- **GIVEN** the active language is `ar`
- **WHEN** any screen renders `t('branding.appName')`
- **THEN** the rendered string is "خدمة القديس مينا"

#### Scenario: Device home screen shows English bundle name

- **WHEN** the user views the device home screen
- **THEN** the icon caption reads "St. Mina Connect" regardless of UI language

### Requirement: An About screen SHALL display app and church identity information.

`app/(app)/about.tsx` MUST render:

- App name, version, and build SHA (if available).
- Church identity from `src/branding/church.ts` (name, address, languages spoken, contact).
- Credits for fonts (Inter, IBM Plex Sans Arabic), icon library (lucide-react-native), UI library (react-native-paper), and any optional acknowledgments.
- Placeholder links to Privacy Policy and Terms of Service (real URLs are wired in `add-gdpr-compliance`).

#### Scenario: About surfaces version

- **WHEN** the About screen renders
- **THEN** the version reads from `Constants.expoConfig?.version`
- **AND** matches the value in `app.json`

#### Scenario: Credits include required font notices

- **WHEN** the About screen Credits section renders
- **THEN** it includes the Inter OFL notice
- **AND** the IBM Plex Sans Arabic OFL notice
- **AND** the Lucide ISC notice
- **AND** the React Native Paper MIT notice
