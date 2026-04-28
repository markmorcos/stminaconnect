/**
 * Verifies that the in-app legal reader screens re-render when the
 * active i18n language changes — both the body content and the font.
 */
import { act, render, waitFor } from '@testing-library/react-native';
import i18next from 'i18next';
import { Provider as PaperProvider } from 'react-native-paper';

import PrivacyDocScreen from '@/../app/(app)/legal/privacy';
import TermsDocScreen from '@/../app/(app)/legal/terms';
import { ThemeProvider } from '@/design/ThemeProvider';

function renderScreen() {
  return render(
    <PaperProvider>
      <ThemeProvider initialMode="light">
        <PrivacyDocScreen />
      </ThemeProvider>
    </PaperProvider>,
  );
}

describe('Privacy reader screen — language reactivity', () => {
  beforeEach(async () => {
    // eslint-disable-next-line import/no-named-as-default-member
    await i18next.changeLanguage('en');
  });

  it('renders English content when language is en', async () => {
    const { getByText } = renderScreen();
    await waitFor(() => expect(getByText(/Privacy Policy/i)).toBeTruthy());
  });

  it('re-renders to German content after a language change', async () => {
    const { getByText, queryByText } = renderScreen();
    await waitFor(() => expect(getByText(/Privacy Policy/i)).toBeTruthy());
    await act(async () => {
      // eslint-disable-next-line import/no-named-as-default-member
      await i18next.changeLanguage('de');
    });
    await waitFor(() => expect(getByText(/Datenschutzerklärung/i)).toBeTruthy());
    expect(queryByText(/^Privacy Policy/m)).toBeNull();
  });

  it('re-renders to Arabic content after a language change', async () => {
    const { getByText } = renderScreen();
    await waitFor(() => expect(getByText(/Privacy Policy/i)).toBeTruthy());
    await act(async () => {
      // eslint-disable-next-line import/no-named-as-default-member
      await i18next.changeLanguage('ar');
    });
    await waitFor(() => expect(getByText(/سياسة الخصوصية/)).toBeTruthy());
  });
});

describe('Terms reader screen — language reactivity', () => {
  beforeEach(async () => {
    // eslint-disable-next-line import/no-named-as-default-member
    await i18next.changeLanguage('en');
  });

  it('re-renders to German content after a language change', async () => {
    const { getByText } = render(
      <PaperProvider>
        <ThemeProvider initialMode="light">
          <TermsDocScreen />
        </ThemeProvider>
      </PaperProvider>,
    );
    await waitFor(() => expect(getByText(/Terms of Service/i)).toBeTruthy());
    await act(async () => {
      // eslint-disable-next-line import/no-named-as-default-member
      await i18next.changeLanguage('de');
    });
    await waitFor(() => expect(getByText(/Nutzungsbedingungen/i)).toBeTruthy());
  });
});
