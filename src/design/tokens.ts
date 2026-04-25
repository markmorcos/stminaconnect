/**
 * Design tokens — pure data, no React, no Paper imports.
 *
 * Every value used by the design system originates here. Components MUST
 * read from `tokens` (or via `useTokens()`); ad-hoc hex codes or pixel
 * sizes in feature code are prohibited (see `design-system` capability).
 *
 * Iteration history & rationale: see openspec/specs/design-system and the
 * `setup-design-system` change for color/typography/spacing decisions.
 */

export type ColorRole =
  | 'primary'
  | 'primaryMuted'
  | 'secondary'
  | 'accent'
  | 'background'
  | 'surface'
  | 'surfaceElevated'
  | 'text'
  | 'textMuted'
  | 'textInverse'
  | 'border'
  | 'success'
  | 'warning'
  | 'error'
  | 'info';

export type ColorPalette = Record<ColorRole, string>;

export const colors: { light: ColorPalette; dark: ColorPalette } = {
  light: {
    primary: '#8B1E2D',
    primaryMuted: '#B85565',
    secondary: '#C9A961',
    accent: '#445A8A',
    background: '#FBF8F4',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    text: '#1C1A18',
    textMuted: '#5C544D',
    textInverse: '#FBF8F4',
    border: '#E5DED5',
    success: '#2E7D52',
    warning: '#B45309',
    error: '#B0263C',
    info: '#445A8A',
  },
  dark: {
    primary: '#D45D6E',
    primaryMuted: '#7A2A37',
    secondary: '#E2BE7A',
    accent: '#7A8DC4',
    background: '#15110E',
    surface: '#1F1A16',
    surfaceElevated: '#2A231D',
    text: '#F5EFE7',
    textMuted: '#B5ABA0',
    textInverse: '#1C1A18',
    border: '#3A322A',
    success: '#5BB387',
    warning: '#E0A85C',
    error: '#E47388',
    info: '#7A8DC4',
  },
};

/**
 * 8 background colors used for deterministic Avatar tinting. Every entry
 * passes WCAG AA Large against white text (verified by unit test).
 */
export const avatarPalette: readonly string[] = [
  '#8B1E2D', // deep red
  '#445A8A', // muted indigo
  '#2E7D52', // green
  '#7D3C5C', // plum
  '#5C4A2C', // warm brown
  '#8A4A1F', // burnt sienna
  '#3F5963', // slate
  '#5B3A91', // royal purple
] as const;

export type TypographyVariant =
  | 'displayLg'
  | 'displayMd'
  | 'headingLg'
  | 'headingMd'
  | 'headingSm'
  | 'bodyLg'
  | 'body'
  | 'bodySm'
  | 'caption'
  | 'label';

export interface TypographyDef {
  size: number;
  lineHeight: number;
  weight: '400' | '500' | '600' | '700';
  letterSpacing?: number;
  textTransform?: 'uppercase';
}

export const typography: Record<TypographyVariant, TypographyDef> = {
  displayLg: { size: 32, lineHeight: 32 * 1.2, weight: '700' },
  displayMd: { size: 28, lineHeight: 28 * 1.25, weight: '700' },
  headingLg: { size: 22, lineHeight: 22 * 1.3, weight: '600' },
  headingMd: { size: 18, lineHeight: 18 * 1.35, weight: '600' },
  headingSm: { size: 16, lineHeight: 16 * 1.4, weight: '600' },
  bodyLg: { size: 16, lineHeight: 16 * 1.5, weight: '400' },
  body: { size: 14, lineHeight: 14 * 1.5, weight: '400' },
  bodySm: { size: 13, lineHeight: 13 * 1.45, weight: '400' },
  caption: { size: 12, lineHeight: 12 * 1.4, weight: '500' },
  label: {
    size: 12,
    lineHeight: 12 * 1.3,
    weight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
};

export const fontFamilies = {
  latin: {
    '400': 'Inter-Regular',
    '500': 'Inter-Medium',
    '600': 'Inter-SemiBold',
    '700': 'Inter-Bold',
  },
  arabic: {
    '400': 'IBMPlexSansArabic-Regular',
    '500': 'IBMPlexSansArabic-Medium',
    '600': 'IBMPlexSansArabic-SemiBold',
    '700': 'IBMPlexSansArabic-Bold',
  },
} as const;

export type SpacingKey = '0' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';

export const spacing: Record<SpacingKey, number> = {
  '0': 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
};

export type RadiiKey = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export const radii: Record<RadiiKey, number> = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export type ElevationKey = 'none' | 'sm' | 'md' | 'lg';

export interface ElevationDef {
  /** Android elevation value (dp) */
  elevation: number;
  /** iOS shadow */
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
}

export const elevation: Record<ElevationKey, ElevationDef> = {
  none: {
    elevation: 0,
    shadowColor: '#000000',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  sm: {
    elevation: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  md: {
    elevation: 3,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  lg: {
    elevation: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
};

export const motion = {
  durationFast: 150,
  durationBase: 250,
  durationSlow: 400,
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    decelerate: 'cubic-bezier(0, 0, 0, 1)',
    accelerate: 'cubic-bezier(0.3, 0, 1, 1)',
  },
} as const;

export type Tokens = {
  colors: ColorPalette;
  typography: typeof typography;
  spacing: typeof spacing;
  radii: typeof radii;
  elevation: typeof elevation;
  motion: typeof motion;
  avatarPalette: typeof avatarPalette;
  fontFamilies: typeof fontFamilies;
};

export function tokensFor(mode: 'light' | 'dark'): Tokens {
  return {
    colors: colors[mode],
    typography,
    spacing,
    radii,
    elevation,
    motion,
    avatarPalette,
    fontFamilies,
  };
}
