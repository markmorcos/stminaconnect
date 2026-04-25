/**
 * Divider — 1dp horizontal line in `colors.border`. Use for separating
 * list rows or sections within a Card.
 */
import { View, type ViewStyle } from 'react-native';

import { useTokens } from '../ThemeProvider';

export interface DividerProps {
  style?: ViewStyle;
}

export function Divider({ style }: DividerProps) {
  const { colors } = useTokens();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[{ height: 1, backgroundColor: colors.border, alignSelf: 'stretch' }, style]}
    />
  );
}
