/**
 * Input — token-aware wrapper around Paper TextInput.
 *
 * Props: `label`, `helper`, `error` (string | undefined). When `error`
 * is set, the helper line displays the error in `colors.error` and the
 * input gets the error border.
 *
 * a11y: forwards `accessibilityLabel`; defaults to `label` when unset.
 */
import { View, type ViewStyle } from 'react-native';
import { HelperText, TextInput, type TextInputProps } from 'react-native-paper';

import { useTokens } from '../ThemeProvider';

export interface InputProps extends Omit<TextInputProps, 'label' | 'error' | 'mode'> {
  label?: string;
  helper?: string;
  error?: string;
  mode?: 'flat' | 'outlined';
  style?: ViewStyle;
}

export function Input({
  label,
  helper,
  error,
  mode = 'outlined',
  accessibilityLabel,
  style,
  ...rest
}: InputProps) {
  const { spacing } = useTokens();
  const hasError = Boolean(error);
  return (
    <View style={[{ marginBottom: spacing.sm }, style]}>
      <TextInput
        label={label}
        mode={mode}
        error={hasError}
        accessibilityLabel={accessibilityLabel ?? label}
        {...rest}
      />
      {(error ?? helper) ? (
        <HelperText type={hasError ? 'error' : 'info'} visible>
          {error ?? helper}
        </HelperText>
      ) : null}
    </View>
  );
}
