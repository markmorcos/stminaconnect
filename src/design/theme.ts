import { MD3DarkTheme, MD3LightTheme, type MD3Theme, configureFonts } from 'react-native-paper';

import { colors, radii, fontFamilies } from './tokens';

type ThemeMode = 'light' | 'dark';

/**
 * Build a full Paper MD3 theme from our brand tokens. Paper retains its
 * a11y wiring (focus rings, screen-reader hooks, hit targets); our tokens
 * govern every visible color, shape, and font family.
 */
export function buildPaperTheme(mode: ThemeMode): MD3Theme {
  const palette = colors[mode];
  const base = mode === 'dark' ? MD3DarkTheme : MD3LightTheme;

  const fontConfig = configureFonts({
    config: {
      fontFamily: fontFamilies.latin['400'],
    },
  });

  return {
    ...base,
    dark: mode === 'dark',
    roundness: radii.md,
    fonts: fontConfig,
    colors: {
      ...base.colors,
      primary: palette.primary,
      primaryContainer: palette.primaryMuted,
      secondary: palette.secondary,
      secondaryContainer: palette.primaryMuted,
      tertiary: palette.accent,
      tertiaryContainer: palette.accent,
      surface: palette.surface,
      surfaceVariant: palette.surfaceElevated,
      surfaceDisabled: palette.border,
      background: palette.background,
      error: palette.error,
      errorContainer: palette.error,
      onPrimary: palette.textInverse,
      onPrimaryContainer: palette.text,
      onSecondary: palette.text,
      onSecondaryContainer: palette.text,
      onTertiary: palette.textInverse,
      onTertiaryContainer: palette.text,
      onSurface: palette.text,
      onSurfaceVariant: palette.textMuted,
      onSurfaceDisabled: palette.textMuted,
      onError: palette.textInverse,
      onErrorContainer: palette.text,
      onBackground: palette.text,
      outline: palette.border,
      outlineVariant: palette.border,
      inverseSurface: mode === 'dark' ? colors.light.surface : colors.dark.surface,
      inverseOnSurface: mode === 'dark' ? colors.light.text : colors.dark.text,
      inversePrimary: mode === 'dark' ? colors.light.primary : colors.dark.primary,
      shadow: '#000000',
      scrim: '#000000',
      backdrop: 'rgba(0,0,0,0.5)',
      elevation: {
        level0: 'transparent',
        level1: palette.surface,
        level2: palette.surfaceElevated,
        level3: palette.surfaceElevated,
        level4: palette.surfaceElevated,
        level5: palette.surfaceElevated,
      },
    },
  };
}

export type { ThemeMode };
