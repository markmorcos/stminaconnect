/**
 * Layout primitives — `Stack` (vertical), `Inline` (horizontal), `Box`
 * (sized container). Spacing/padding/margin props all map to spacing
 * tokens. Use logical properties (`marginStart`/`paddingEnd`) so RTL
 * Just Works.
 *
 * Avoid using these for one-off layouts that don't repeat — use raw
 * `View` with token references in those cases.
 */
import { Children, type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

import { useTokens } from '../ThemeProvider';
import type { SpacingKey } from '../tokens';

type SpacingProp = SpacingKey;

interface CommonProps {
  children?: ReactNode;
  padding?: SpacingProp;
  paddingX?: SpacingProp;
  paddingY?: SpacingProp;
  paddingStart?: SpacingProp;
  paddingEnd?: SpacingProp;
  paddingTop?: SpacingProp;
  paddingBottom?: SpacingProp;
  margin?: SpacingProp;
  marginX?: SpacingProp;
  marginY?: SpacingProp;
  marginStart?: SpacingProp;
  marginEnd?: SpacingProp;
  marginTop?: SpacingProp;
  marginBottom?: SpacingProp;
  flex?: number;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

interface StackProps extends CommonProps {
  gap?: SpacingProp;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
}

interface InlineProps extends StackProps {
  wrap?: boolean;
}

interface BoxProps extends CommonProps {
  width?: number | `${number}%`;
  height?: number | `${number}%`;
  backgroundColor?: string;
  borderRadius?: number;
}

function commonStyle(spacing: Record<SpacingKey, number>, p: CommonProps): ViewStyle {
  return {
    padding: p.padding ? spacing[p.padding] : undefined,
    paddingHorizontal: p.paddingX ? spacing[p.paddingX] : undefined,
    paddingVertical: p.paddingY ? spacing[p.paddingY] : undefined,
    paddingStart: p.paddingStart ? spacing[p.paddingStart] : undefined,
    paddingEnd: p.paddingEnd ? spacing[p.paddingEnd] : undefined,
    paddingTop: p.paddingTop ? spacing[p.paddingTop] : undefined,
    paddingBottom: p.paddingBottom ? spacing[p.paddingBottom] : undefined,
    margin: p.margin ? spacing[p.margin] : undefined,
    marginHorizontal: p.marginX ? spacing[p.marginX] : undefined,
    marginVertical: p.marginY ? spacing[p.marginY] : undefined,
    marginStart: p.marginStart ? spacing[p.marginStart] : undefined,
    marginEnd: p.marginEnd ? spacing[p.marginEnd] : undefined,
    marginTop: p.marginTop ? spacing[p.marginTop] : undefined,
    marginBottom: p.marginBottom ? spacing[p.marginBottom] : undefined,
    flex: p.flex,
  };
}

export function Stack({
  children,
  gap,
  align,
  justify,
  style,
  accessibilityLabel,
  ...rest
}: StackProps) {
  const { spacing } = useTokens();
  const gapPx = gap ? spacing[gap] : 0;
  const items = Children.toArray(children);
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[
        commonStyle(spacing, rest),
        { flexDirection: 'column', alignItems: align, justifyContent: justify },
        style,
      ]}
    >
      {items.map((child, idx) => (
        <View key={idx} style={{ marginTop: idx === 0 ? 0 : gapPx }}>
          {child}
        </View>
      ))}
    </View>
  );
}

export function Inline({
  children,
  gap,
  align,
  justify,
  wrap,
  style,
  accessibilityLabel,
  ...rest
}: InlineProps) {
  const { spacing } = useTokens();
  const gapPx = gap ? spacing[gap] : 0;
  const items = Children.toArray(children);
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[
        commonStyle(spacing, rest),
        {
          flexDirection: 'row',
          alignItems: align,
          justifyContent: justify,
          flexWrap: wrap ? 'wrap' : 'nowrap',
        },
        style,
      ]}
    >
      {items.map((child, idx) => (
        <View key={idx} style={{ marginStart: idx === 0 ? 0 : gapPx }}>
          {child}
        </View>
      ))}
    </View>
  );
}

export function Box({
  children,
  width,
  height,
  backgroundColor,
  borderRadius,
  style,
  accessibilityLabel,
  ...rest
}: BoxProps) {
  const { spacing } = useTokens();
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[commonStyle(spacing, rest), { width, height, backgroundColor, borderRadius }, style]}
    >
      {children}
    </View>
  );
}

export type { StackProps, InlineProps, BoxProps };
