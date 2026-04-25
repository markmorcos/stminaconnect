/**
 * Snackbar — Paper Snackbar themed against tokens. Used for transient
 * status messages ("Saved", "Synced", "Couldn't reach server").
 *
 * a11y: the message is announced to screen readers automatically by
 * Paper; the action button gets `accessibilityRole="button"`.
 */
import { Snackbar as PaperSnackbar, type SnackbarProps as PaperProps } from 'react-native-paper';

export type SnackbarProps = PaperProps;

export function Snackbar(props: SnackbarProps) {
  return <PaperSnackbar {...props} />;
}

export { PaperSnackbar as RawSnackbar };
