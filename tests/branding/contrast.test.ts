/**
 * Brand-locked contrast suite.
 *
 * Walks every documented text-on-surface pairing produced by the design
 * system and asserts WCAG AA. This is the brand-locking moment for
 * accessibility: every pairing here must pass on real-device rendering.
 *
 * If a pairing fails, prefer nudging the offending token in
 * `src/design/tokens.ts` over relaxing the threshold.
 */
import { colors, avatarPalette } from '@/design/tokens';
import { contrastRatio, WCAG } from '@/design/utils/contrast';

type Mode = 'light' | 'dark';

interface Pairing {
  fg: keyof (typeof colors)['light'];
  bg: keyof (typeof colors)['light'];
  /** AA Normal (4.5) or AA Large (3.0). */
  level: 'normal' | 'large';
}

/**
 * Documented pairings. Each entry corresponds to a real component +
 * variant produced by the design system primitives.
 */
/** Pairings whose foreground role is the same in both modes. */
const BODY_PAIRINGS: Pairing[] = [
  // Surfaces
  { fg: 'text', bg: 'background', level: 'normal' },
  { fg: 'text', bg: 'surface', level: 'normal' },
  { fg: 'text', bg: 'surfaceElevated', level: 'normal' },
  { fg: 'textMuted', bg: 'background', level: 'normal' },
  { fg: 'textMuted', bg: 'surface', level: 'normal' },
  // Buttons
  { fg: 'textInverse', bg: 'primary', level: 'normal' },
  { fg: 'textInverse', bg: 'error', level: 'normal' },
  // Badges
  { fg: 'textInverse', bg: 'success', level: 'normal' },
  { fg: 'textInverse', bg: 'warning', level: 'normal' },
  { fg: 'textInverse', bg: 'info', level: 'normal' },
  { fg: 'text', bg: 'border', level: 'normal' },
];

/**
 * Pairings that resolve a different role per mode. Secondary's gold
 * background needs dark ink in both modes; that's `text` in light and
 * `textInverse` in dark (see Button.tsx).
 */
const PER_MODE_PAIRINGS: Record<Mode, Pairing[]> = {
  light: [{ fg: 'text', bg: 'secondary', level: 'normal' }],
  dark: [{ fg: 'textInverse', bg: 'secondary', level: 'normal' }],
};

/**
 * Pairings used at large-text sizes only (≥ 18.66 px bold or ≥ 24 px
 * regular per WCAG). These get the AA Large threshold of 3.0.
 */
const LARGE_PAIRINGS: Pairing[] = [
  // Ghost button text and Logo glyph stroke against the canvas.
  { fg: 'primary', bg: 'background', level: 'large' },
  { fg: 'accent', bg: 'background', level: 'large' },
];

const ALL_PAIRINGS: Pairing[] = [...BODY_PAIRINGS, ...LARGE_PAIRINGS];

function threshold(level: Pairing['level']): number {
  return level === 'normal' ? WCAG.AA_NORMAL : WCAG.AA_LARGE;
}

function describePairing(mode: Mode, p: Pairing): string {
  return `${p.fg} on ${p.bg} (${mode}, ${p.level})`;
}

describe('Brand contrast — light mode', () => {
  const pairings = [...ALL_PAIRINGS, ...PER_MODE_PAIRINGS.light];
  it.each(pairings.map((p) => [describePairing('light', p), p] as const))(
    '%s passes WCAG AA',
    (_, p) => {
      const ratio = contrastRatio(colors.light[p.fg], colors.light[p.bg]);
      expect(ratio).toBeGreaterThanOrEqual(threshold(p.level));
    },
  );
});

describe('Brand contrast — dark mode', () => {
  const pairings = [...ALL_PAIRINGS, ...PER_MODE_PAIRINGS.dark];
  it.each(pairings.map((p) => [describePairing('dark', p), p] as const))(
    '%s passes WCAG AA',
    (_, p) => {
      const ratio = contrastRatio(colors.dark[p.fg], colors.dark[p.bg]);
      expect(ratio).toBeGreaterThanOrEqual(threshold(p.level));
    },
  );
});

describe('Avatar palette — white text', () => {
  it.each(avatarPalette.map((c, i) => [`avatarPalette[${i}]=${c}`, c] as const))(
    '%s passes AA Large vs white',
    (_, color) => {
      const ratio = contrastRatio(color, '#FFFFFF');
      expect(ratio).toBeGreaterThanOrEqual(WCAG.AA_LARGE);
    },
  );
});
