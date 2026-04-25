/**
 * Snapshot every base component × {light, dark, RTL light}.
 * That's 16 components × 3 contexts = 48 snapshots.
 */
import { render } from '@testing-library/react-native';
import { I18nManager } from 'react-native';
import type { ReactElement } from 'react';

import { ThemeProvider } from '@/design/ThemeProvider';
import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  IconButton,
  Inline,
  Input,
  LoadingSkeleton,
  Modal,
  Select,
  Sheet,
  Snackbar,
  Spinner,
  Stack,
  Text,
} from '@/design/components';

type Mode = 'light' | 'dark';

function withProvider(node: ReactElement, mode: Mode) {
  return <ThemeProvider initialMode={mode}>{node}</ThemeProvider>;
}

const cases: Record<string, ReactElement> = {
  Text: <Text variant="headingLg">Hello</Text>,
  Button: <Button onPress={() => {}}>Tap</Button>,
  Input: <Input label="Name" helper="Helper" />,
  Select: <Select value="a" options={[{ value: 'a', label: 'A' }]} onChange={() => {}} />,
  Card: (
    <Card>
      <Text>Inside</Text>
    </Card>
  ),
  Avatar: <Avatar id="p-1" firstName="Mariam" lastName="Saad" />,
  Badge: <Badge variant="priorityHigh">High</Badge>,
  Chip: <Chip selected>Selected</Chip>,
  IconButton: <IconButton name="bell" accessibilityLabel="Notifications" />,
  Spinner: <Spinner />,
  LoadingSkeleton: <LoadingSkeleton width={100} height={12} />,
  EmptyState: <EmptyState icon="users" title="No people" body="Add someone." />,
  Snackbar: (
    <Snackbar visible onDismiss={() => {}}>
      Message
    </Snackbar>
  ),
  Divider: <Divider />,
  Sheet: (
    <Sheet visible onDismiss={() => {}}>
      <Text>Sheet body</Text>
    </Sheet>
  ),
  Modal: (
    <Modal visible onDismiss={() => {}}>
      <Text>Modal body</Text>
    </Modal>
  ),
  Layout: (
    <Stack gap="md">
      <Inline gap="sm">
        <Box width={32} height={32} backgroundColor="#000" />
        <Box width={32} height={32} backgroundColor="#888" />
      </Inline>
    </Stack>
  ),
};

function snapshot(node: unknown) {
  // Render the JSON tree; jest's serializer makes it diff-friendly.
  return JSON.parse(JSON.stringify(node));
}

describe('Component snapshots — light', () => {
  for (const [name, node] of Object.entries(cases)) {
    it(`${name}`, () => {
      const { toJSON } = render(withProvider(node, 'light'));
      expect(toJSON()).toMatchSnapshot();
    });
  }
});

describe('Component snapshots — dark', () => {
  for (const [name, node] of Object.entries(cases)) {
    it(`${name}`, () => {
      const { toJSON } = render(withProvider(node, 'dark'));
      expect(toJSON()).toMatchSnapshot();
    });
  }
});

describe('Component snapshots — RTL', () => {
  const original = I18nManager.isRTL;
  beforeAll(() => {
    Object.defineProperty(I18nManager, 'isRTL', { value: true, configurable: true });
    I18nManager.forceRTL?.(true);
  });
  afterAll(() => {
    Object.defineProperty(I18nManager, 'isRTL', { value: original, configurable: true });
    I18nManager.forceRTL?.(original);
  });
  for (const [name, node] of Object.entries(cases)) {
    it(`${name}`, () => {
      const { toJSON } = render(withProvider(node, 'light'));
      expect(toJSON()).toMatchSnapshot();
    });
  }
});

// Quiet linter: snapshot helper above could be exported in case future
// tests want raw tree comparison.
export { snapshot };
