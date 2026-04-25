import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  Icon,
  IconButton,
  Inline,
  Input,
  LoadingSkeleton,
  Logo,
  Modal,
  Select,
  Sheet,
  Snackbar,
  Spinner,
  Stack,
  Text,
  useTheme,
  useTokens,
  type ThemeModeSetting,
} from '@/design';

const SECTIONS = ['tokens', 'components'] as const;
type SectionId = (typeof SECTIONS)[number];

export default function Showcase() {
  const { mode, setMode } = useTheme();
  const { colors } = useTokens();
  const [section, setSection] = useState<SectionId>('tokens');
  const [modalOpen, setModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [snackOpen, setSnackOpen] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ModeSwitcher mode={mode} setMode={setMode} />
      <SectionSwitcher section={section} setSection={setSection} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 64 }}>
        {section === 'tokens' ? <TokensView /> : null}
        {section === 'components' ? (
          <ComponentsView
            modalOpen={modalOpen}
            setModalOpen={setModalOpen}
            sheetOpen={sheetOpen}
            setSheetOpen={setSheetOpen}
            snackOpen={snackOpen}
            setSnackOpen={setSnackOpen}
          />
        ) : null}
      </ScrollView>
      <Modal
        visible={modalOpen}
        onDismiss={() => setModalOpen(false)}
        accessibilityLabel="Showcase modal"
      >
        <Stack gap="md">
          <Text variant="headingMd">Modal title</Text>
          <Text>Body content goes here.</Text>
          <Button onPress={() => setModalOpen(false)}>Close</Button>
        </Stack>
      </Modal>
      <Sheet
        visible={sheetOpen}
        onDismiss={() => setSheetOpen(false)}
        accessibilityLabel="Showcase sheet"
      >
        <Stack gap="md">
          <Text variant="headingMd">Bottom sheet</Text>
          <Text>Drag down or tap outside to dismiss.</Text>
          <Button variant="ghost" onPress={() => setSheetOpen(false)}>
            Done
          </Button>
        </Stack>
      </Sheet>
      <Snackbar visible={snackOpen} onDismiss={() => setSnackOpen(false)} duration={3000}>
        Saved.
      </Snackbar>
    </View>
  );
}

function ModeSwitcher({
  mode,
  setMode,
}: {
  mode: ThemeModeSetting;
  setMode: (m: ThemeModeSetting) => Promise<void>;
}) {
  const { colors, spacing } = useTokens();
  return (
    <View style={{ backgroundColor: colors.surfaceElevated, paddingTop: spacing.xl }}>
      <Inline gap="sm" paddingX="lg" paddingY="sm" align="center">
        <Text variant="caption" color={colors.textMuted}>
          Theme:
        </Text>
        {(['system', 'light', 'dark'] as const).map((m) => (
          <Chip key={m} selected={mode === m} onPress={() => setMode(m)}>
            {m}
          </Chip>
        ))}
      </Inline>
    </View>
  );
}

function SectionSwitcher({
  section,
  setSection,
}: {
  section: SectionId;
  setSection: (s: SectionId) => void;
}) {
  const { colors } = useTokens();
  return (
    <Inline
      gap="sm"
      paddingX="lg"
      paddingY="sm"
      style={{
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      {SECTIONS.map((s) => (
        <Chip key={s} selected={section === s} onPress={() => setSection(s)}>
          {s}
        </Chip>
      ))}
    </Inline>
  );
}

function TokensView() {
  const { colors, typography, spacing, radii, avatarPalette } = useTokens();
  const colorEntries = Object.entries(colors) as [string, string][];

  return (
    <Stack gap="lg">
      <Section title="Colors">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {colorEntries.map(([name, value]) => (
            <View key={name} style={{ width: 96, alignItems: 'center' }}>
              <Box
                width={88}
                height={48}
                borderRadius={radii.md}
                backgroundColor={value}
                style={{ borderWidth: 1, borderColor: colors.border }}
              />
              <Text variant="caption" color={colors.textMuted} align="center">
                {name}
              </Text>
              <Text variant="caption" color={colors.textMuted} align="center">
                {value}
              </Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Avatar palette">
        <Inline gap="sm" wrap>
          {avatarPalette.map((c, i) => (
            <Box
              key={c}
              width={40}
              height={40}
              borderRadius={20}
              backgroundColor={c}
              accessibilityLabel={`avatarPalette[${i}] ${c}`}
            />
          ))}
        </Inline>
      </Section>

      <Section title="Typography">
        <Stack gap="sm">
          {(Object.keys(typography) as (keyof typeof typography)[]).map((variant) => (
            <Text key={variant} variant={variant}>
              {variant} — The quick brown fox
            </Text>
          ))}
        </Stack>
      </Section>

      <Section title="Spacing">
        <Stack gap="xs">
          {(Object.keys(spacing) as (keyof typeof spacing)[]).map((key) => (
            <Inline key={key} gap="md" align="center">
              <Text variant="caption" color={colors.textMuted} style={{ width: 32 }}>
                {key}
              </Text>
              <Box height={8} width={spacing[key] || 1} backgroundColor={colors.primary} />
              <Text variant="caption" color={colors.textMuted}>
                {spacing[key]}px
              </Text>
            </Inline>
          ))}
        </Stack>
      </Section>

      <Section title="Radii">
        <Inline gap="md" wrap>
          {(Object.keys(radii) as (keyof typeof radii)[]).map((key) => (
            <Stack key={key} align="center" gap="xs">
              <Box
                width={48}
                height={48}
                borderRadius={radii[key]}
                backgroundColor={colors.primary}
              />
              <Text variant="caption" color={colors.textMuted}>
                {key}
              </Text>
            </Stack>
          ))}
        </Inline>
      </Section>
    </Stack>
  );
}

function ComponentsView({
  modalOpen,
  setModalOpen,
  sheetOpen,
  setSheetOpen,
  snackOpen,
  setSnackOpen,
}: {
  modalOpen: boolean;
  setModalOpen: (b: boolean) => void;
  sheetOpen: boolean;
  setSheetOpen: (b: boolean) => void;
  snackOpen: boolean;
  setSnackOpen: (b: boolean) => void;
}) {
  const [chipSel, setChipSel] = useState<string | null>('one');
  const [select, setSelect] = useState<string>('a');
  return (
    <Stack gap="lg">
      <Section title="Buttons">
        <Inline gap="sm" wrap>
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </Inline>
      </Section>

      <Section title="Inputs">
        <Stack gap="sm">
          <Input label="Name" helper="Your full name" />
          <Input label="Email" error="Invalid email" />
        </Stack>
      </Section>

      <Section title="Select">
        <Select
          value={select}
          onChange={setSelect}
          options={[
            { value: 'a', label: 'Option A' },
            { value: 'b', label: 'Option B' },
            { value: 'c', label: 'Option C' },
          ]}
        />
      </Section>

      <Section title="Avatars">
        <Inline gap="sm">
          <Avatar id="p-1" firstName="Mariam" lastName="Saad" size="sm" />
          <Avatar id="p-2" firstName="George" lastName="Hanna" size="md" />
          <Avatar id="p-3" firstName="مريم" lastName="سعد" size="lg" />
        </Inline>
      </Section>

      <Section title="Badges">
        <Inline gap="sm" wrap>
          <Badge>neutral</Badge>
          <Badge variant="success">success</Badge>
          <Badge variant="warning">warning</Badge>
          <Badge variant="error">error</Badge>
          <Badge variant="info">info</Badge>
          <Badge variant="priorityHigh">High</Badge>
          <Badge variant="priorityMedium">Medium</Badge>
          <Badge variant="priorityLow">Low</Badge>
          <Badge variant="priorityVeryLow">Very low</Badge>
        </Inline>
      </Section>

      <Section title="Chips">
        <Inline gap="sm" wrap>
          {['one', 'two', 'three'].map((v) => (
            <Chip key={v} selected={chipSel === v} onPress={() => setChipSel(v)}>
              {v}
            </Chip>
          ))}
        </Inline>
      </Section>

      <Section title="IconButton & Icon">
        <Inline gap="sm">
          <IconButton name="bell" accessibilityLabel="Notifications" />
          <IconButton name="settings" accessibilityLabel="Settings" />
          <Icon name="heart" />
          <Icon name="check" />
        </Inline>
      </Section>

      <Section title="Card">
        <Card>
          <Stack gap="sm">
            <Text variant="headingSm">Card title</Text>
            <Text>Body content inside a Card.</Text>
          </Stack>
        </Card>
      </Section>

      <Section title="Spinner / Skeleton">
        <Inline gap="md" align="center">
          <Spinner />
          <Spinner size="lg" />
          <Stack gap="xs" flex={1}>
            <LoadingSkeleton />
            <LoadingSkeleton width="60%" />
          </Stack>
        </Inline>
      </Section>

      <Section title="EmptyState">
        <EmptyState icon="users" title="No people yet" body="Add someone to get started." />
      </Section>

      <Section title="Logo">
        <Stack gap="md">
          <Inline gap="lg" align="center" wrap>
            {(['sm', 'md', 'lg', 'xl'] as const).map((s) => (
              <Logo key={`mark-${s}`} variant="mark" size={s} />
            ))}
          </Inline>
          <Inline gap="lg" align="center" wrap>
            {(['sm', 'md', 'lg', 'xl'] as const).map((s) => (
              <Logo key={`combined-${s}`} variant="combined" size={s} />
            ))}
          </Inline>
        </Stack>
      </Section>

      <Section title="Divider">
        <Divider />
      </Section>

      <Section title="Modal / Sheet / Snackbar">
        <Inline gap="sm" wrap>
          <Button onPress={() => setModalOpen(true)}>Open modal</Button>
          <Button variant="secondary" onPress={() => setSheetOpen(true)}>
            Open sheet
          </Button>
          <Button variant="ghost" onPress={() => setSnackOpen(true)}>
            Show snack
          </Button>
        </Inline>
      </Section>

      <Hidden visible={modalOpen || sheetOpen || snackOpen} />
    </Stack>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Stack gap="sm">
      <Text variant="label">{title}</Text>
      {children}
    </Stack>
  );
}

function Hidden({ visible }: { visible: boolean }) {
  // Prevents unused-var warnings on test render of overlay state without
  // making them unconditionally mounted.
  return visible ? null : null;
}
