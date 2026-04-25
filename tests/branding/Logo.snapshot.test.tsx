/**
 * Snapshot every Logo (variant × size) under {light, dark, RTL light}.
 * 2 variants × 4 sizes × 3 contexts = 24 snapshots.
 */
import type { ReactElement } from 'react';
import { render } from '@testing-library/react-native';
import { I18nManager } from 'react-native';

import { ThemeProvider } from '@/design/ThemeProvider';
import { Logo, type LogoSize, type LogoVariant } from '@/design/components';

type Mode = 'light' | 'dark';

const VARIANTS: LogoVariant[] = ['mark', 'combined'];
const SIZES: LogoSize[] = ['sm', 'md', 'lg', 'xl'];

function withProvider(node: ReactElement, mode: Mode) {
  return <ThemeProvider initialMode={mode}>{node}</ThemeProvider>;
}

function snapshotCases() {
  const cases: Record<string, ReactElement> = {};
  for (const variant of VARIANTS) {
    for (const size of SIZES) {
      cases[`${variant}-${size}`] = <Logo variant={variant} size={size} />;
    }
  }
  return cases;
}

describe('Logo snapshots — light', () => {
  for (const [name, node] of Object.entries(snapshotCases())) {
    it(name, () => {
      const { toJSON } = render(withProvider(node, 'light'));
      expect(toJSON()).toMatchSnapshot();
    });
  }
});

describe('Logo snapshots — dark', () => {
  for (const [name, node] of Object.entries(snapshotCases())) {
    it(name, () => {
      const { toJSON } = render(withProvider(node, 'dark'));
      expect(toJSON()).toMatchSnapshot();
    });
  }
});

describe('Logo snapshots — RTL', () => {
  const original = I18nManager.isRTL;
  beforeAll(() => {
    Object.defineProperty(I18nManager, 'isRTL', { value: true, configurable: true });
    I18nManager.forceRTL?.(true);
  });
  afterAll(() => {
    Object.defineProperty(I18nManager, 'isRTL', { value: original, configurable: true });
    I18nManager.forceRTL?.(original);
  });
  for (const [name, node] of Object.entries(snapshotCases())) {
    it(name, () => {
      const { toJSON } = render(withProvider(node, 'light'));
      expect(toJSON()).toMatchSnapshot();
    });
  }
});
