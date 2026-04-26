/**
 * RemoveMemberDialog — verifies the typed-confirmation gate. The
 * Confirm button stays disabled until the typed text matches the
 * member's full name exactly.
 */
import { fireEvent, render } from '@testing-library/react-native';
import { Provider as PaperProvider } from 'react-native-paper';

import { RemoveMemberDialog } from '@/features/persons/RemoveMemberDialog';
import { ThemeProvider } from '@/design/ThemeProvider';

function renderDialog(props: Partial<React.ComponentProps<typeof RemoveMemberDialog>> = {}) {
  const onCancel = jest.fn();
  const onConfirm = jest.fn();
  const utils = render(
    <PaperProvider>
      <ThemeProvider initialMode="light">
        <RemoveMemberDialog
          visible
          fullName="Mariam Habib"
          onCancel={onCancel}
          onConfirm={onConfirm}
          {...props}
        />
      </ThemeProvider>
    </PaperProvider>,
  );
  return { ...utils, onCancel, onConfirm };
}

describe('RemoveMemberDialog', () => {
  it('Confirm button is disabled until the typed name matches exactly', () => {
    const { getByLabelText, getByText, onConfirm } = renderDialog();

    fireEvent.press(getByText('Remove'));
    expect(onConfirm).not.toHaveBeenCalled();

    const input = getByLabelText('Type the name Mariam Habib to confirm');
    fireEvent.changeText(input, 'Mariam');
    fireEvent.press(getByText('Remove'));
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.changeText(input, 'Mariam Habib');
    fireEvent.press(getByText('Remove'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('cancel calls onCancel and clears the typed name', () => {
    const { getByText, onCancel } = renderDialog();
    fireEvent.press(getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });
});
