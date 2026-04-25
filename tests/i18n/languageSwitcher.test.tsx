/**
 * Language-switcher smoke: renders the three options and prompts the
 * restart-needed Modal when the user picks an option that requires a
 * layout-direction flip.
 */
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { I18nManager } from 'react-native';
import i18next from 'i18next';

import LanguageScreen from '@/../app/(app)/settings/language';
import { ThemeProvider } from '@/design/ThemeProvider';

function renderScreen() {
  return render(
    <ThemeProvider initialMode="light">
      <LanguageScreen />
    </ThemeProvider>,
  );
}

describe('Language switcher', () => {
  beforeEach(async () => {
    Object.defineProperty(I18nManager, 'isRTL', { configurable: true, value: false });
    // eslint-disable-next-line import/no-named-as-default-member -- i18next exposes its API on the default export
    await i18next.changeLanguage('en');
  });

  it('renders three language options', () => {
    const { getByText } = renderScreen();
    expect(getByText('English')).toBeTruthy();
    expect(getByText('العربية')).toBeTruthy();
    expect(getByText('Deutsch')).toBeTruthy();
  });

  it('shows the restart-needed Modal when switching into Arabic from a non-RTL state', async () => {
    const { getByText, queryByText } = renderScreen();
    expect(queryByText('Restart needed')).toBeNull();
    fireEvent.press(getByText('العربية'));
    await waitFor(() => expect(getByText('Restart needed')).toBeTruthy());
  });
});
