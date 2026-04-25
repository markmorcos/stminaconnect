/**
 * Token-driven text. Variants map to `tokens.typography`; font family
 * resolves automatically from the active language (Arabic → IBM Plex
 * Sans Arabic; otherwise Inter).
 *
 * a11y: forwards `accessibilityLabel`. For decorative-only text, set
 * `accessibilityElementsHidden` on the parent.
 */
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useTokens } from '../ThemeProvider';
import { fontFamilies, type TypographyVariant } from '../tokens';
import { isRTLLanguage, useLanguage } from '../useLanguage';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  /** Override token color; defaults to `tokens.colors.text`. */
  color?: string;
  align?: TextStyle['textAlign'];
}

export function Text({ variant = 'body', color, align, style, children, ...rest }: TextProps) {
  const { typography, colors } = useTokens();
  const lang = useLanguage();
  const def = typography[variant];
  const family = isRTLLanguage(lang) ? fontFamilies.arabic : fontFamilies.latin;
  const fontFamily = family[def.weight];

  return (
    <RNText
      style={[
        {
          fontFamily,
          fontSize: def.size,
          lineHeight: def.lineHeight,
          letterSpacing: def.letterSpacing,
          textTransform: def.textTransform,
          color: color ?? colors.text,
          textAlign: align,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}
