/**
 * Logo — the St. Mina Connect brand mark.
 *
 * Variants:
 *   - `mark`     just the cross glyph
 *   - `combined` glyph + wordmark below (RTL: wordmark to inline-end)
 *
 * Sizes are target glyph dimensions in dp; combined adds wordmark
 * height on top of that. Colors resolve from the active theme via
 * `useTokens()` — no literal hex codes leak into feature code.
 */
import { View, type ViewStyle } from 'react-native';
import Svg, { G, Rect } from 'react-native-svg';

import { useTokens } from '../ThemeProvider';
import { isRTLLanguage, useLanguage } from '../useLanguage';
import { Text } from './Text';

export type LogoVariant = 'mark' | 'combined';
export type LogoSize = 'sm' | 'md' | 'lg' | 'xl';

export interface LogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  /** Optional wordmark override; defaults to "St. Mina Connect". */
  wordmark?: string;
  /** Optional accessibility label override; defaults to "St. Mina Connect logo". */
  accessibilityLabel?: string;
  style?: ViewStyle;
}

const SIZE: Record<LogoSize, number> = {
  sm: 24,
  md: 40,
  lg: 64,
  xl: 96,
};

const WORDMARK_VARIANT: Record<LogoSize, 'caption' | 'bodySm' | 'body' | 'bodyLg'> = {
  sm: 'caption',
  md: 'bodySm',
  lg: 'body',
  xl: 'bodyLg',
};

export function Logo({
  variant = 'mark',
  size = 'md',
  wordmark = 'St. Mina Connect',
  accessibilityLabel = 'St. Mina Connect logo',
  style,
}: LogoProps) {
  const { colors } = useTokens();
  const lang = useLanguage();
  const dim = SIZE[size];

  // The SVG uses a 1024 viewBox so all geometry is in absolute units;
  // the canvas scales to `dim`. Outer cross uses primary; inscribed
  // inner stroke uses secondary — readable on light or dark tokens.
  const glyph = (
    <Svg width={dim} height={dim} viewBox="0 0 1024 1024">
      <G fill={colors.primary}>
        <Rect x={432} y={208} width={160} height={608} rx={16} />
        <Rect x={208} y={432} width={608} height={160} rx={16} />
      </G>
      <G fill={colors.secondary}>
        <Rect x={488} y={304} width={48} height={416} rx={8} />
        <Rect x={304} y={488} width={416} height={48} rx={8} />
      </G>
    </Svg>
  );

  if (variant === 'mark') {
    return (
      <View
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
        style={[{ width: dim, height: dim }, style]}
      >
        {glyph}
      </View>
    );
  }

  // Combined variant: stack glyph above wordmark. Direction follows the
  // active language so the wordmark string renders RTL or LTR correctly.
  const isRTL = isRTLLanguage(lang);
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[{ alignItems: 'center' }, style]}
    >
      {glyph}
      <Text
        variant={WORDMARK_VARIANT[size]}
        color={colors.text}
        align="center"
        style={{ marginTop: 8, writingDirection: isRTL ? 'rtl' : 'ltr' }}
      >
        {wordmark}
      </Text>
    </View>
  );
}

// Re-export for tests / other consumers.
export const __LOGO_SIZES = SIZE;
