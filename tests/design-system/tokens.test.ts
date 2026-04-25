import { avatarPalette, colors, elevation, radii, spacing, typography } from '@/design/tokens';
import { contrastRatio, WCAG } from '@/design/contrast';

describe('tokens — color parity', () => {
  it('every light color key has a dark counterpart of the same name', () => {
    const lightKeys = Object.keys(colors.light).sort();
    const darkKeys = Object.keys(colors.dark).sort();
    expect(darkKeys).toEqual(lightKeys);
  });

  it('every dark color key has a light counterpart', () => {
    const lightKeys = new Set(Object.keys(colors.light));
    for (const key of Object.keys(colors.dark)) {
      expect(lightKeys.has(key)).toBe(true);
    }
  });
});

describe('tokens — avatarPalette', () => {
  it('has exactly 8 entries', () => {
    expect(avatarPalette).toHaveLength(8);
  });

  it.each(avatarPalette.map((c, i) => [i, c] as const))(
    'avatarPalette[%i]=%s passes WCAG AA Large for white text',
    (_, color) => {
      const ratio = contrastRatio(color, '#FFFFFF');
      expect(ratio).toBeGreaterThanOrEqual(WCAG.AA_LARGE);
    },
  );
});

describe('tokens — shape integrity', () => {
  it('typography variants are all defined', () => {
    const expected = [
      'displayLg',
      'displayMd',
      'headingLg',
      'headingMd',
      'headingSm',
      'bodyLg',
      'body',
      'bodySm',
      'caption',
      'label',
    ];
    expect(Object.keys(typography).sort()).toEqual(expected.sort());
  });

  it('spacing scale matches the documented scale', () => {
    expect(spacing).toMatchObject({
      '0': 0,
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
      '2xl': 32,
      '3xl': 48,
      '4xl': 64,
    });
  });

  it('radii scale matches the documented scale', () => {
    expect(radii).toMatchObject({
      sm: 4,
      md: 8,
      lg: 12,
      xl: 16,
      full: 9999,
    });
  });

  it('elevation scale defines all four levels', () => {
    expect(Object.keys(elevation).sort()).toEqual(['lg', 'md', 'none', 'sm']);
  });
});

describe('tokens — body text contrast (WCAG AA)', () => {
  type Pairing = readonly [bg: string, fg: string, label: string];
  const lightPairs: Pairing[] = [
    [colors.light.background, colors.light.text, 'text on background (light)'],
    [colors.light.surface, colors.light.text, 'text on surface (light)'],
    [colors.light.primary, colors.light.textInverse, 'textInverse on primary (light)'],
  ];
  const darkPairs: Pairing[] = [
    [colors.dark.background, colors.dark.text, 'text on background (dark)'],
    [colors.dark.surface, colors.dark.text, 'text on surface (dark)'],
  ];

  it.each([...lightPairs, ...darkPairs])('%s meets AA normal', (bg, fg) => {
    expect(contrastRatio(bg, fg)).toBeGreaterThanOrEqual(WCAG.AA_NORMAL);
  });
});
