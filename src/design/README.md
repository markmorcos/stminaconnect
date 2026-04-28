# Design system

The single source of truth for visual identity in St. Mina Connect.
Tokens, theme, fonts, icons, and base components live here. Every
feature screen consumes from this folder — never invents.

## Consuming tokens

Use the hook:

```tsx
import { useTokens } from '@/design';

function MyScreen() {
  const { colors, spacing, radii } = useTokens();
  return <View style={{ backgroundColor: colors.surface, padding: spacing.lg }} />;
}
```

`useTokens()` returns the tokens for the active theme (auto-switches on
system dark mode toggle or user override). Pure-data callers (utilities,
test fixtures) can import the literal `tokens.ts` directly.

## When to add a new component

Add a component to `src/design/components/` when **two or more** future
features will use the same UI affordance. One-off layouts that don't
repeat — a single screen's hero block, a unique chart legend — should
stay in the feature folder using the layout primitives (`Stack`,
`Inline`, `Box`).

Every new component must:

1. Read all colors, sizes, fonts from tokens — no hex codes, no literal
   pixel sizes for spacing.
2. Use logical properties (`marginStart`, `paddingEnd`) so RTL works.
3. Document variants in JSDoc at the top of the file.
4. Export a `*Props` type and be added to
   `src/design/components/index.ts`.
5. Include a snapshot in
   `tests/design-system/components.snapshot.test.tsx` (light + dark +
   RTL).

## When to file a token gap

If a screen needs an off-token color, font size, or spacing, **don't**
hard-code it. Open an issue describing the visual need: that's a token
gap to address in a future design-system change. The exception:
genuinely one-off illustration assets (splash, onboarding hero), which
should still pull their palette from tokens but may set unique sizes
inline.

## Adding an icon

`Icon` only re-exports a curated subset of `lucide-react-native`. To
add an icon:

1. Open `src/design/Icon.tsx`.
2. Add the lucide import.
3. Add the entry to `ICONS`.
4. Submit a PR — do **not** inline-import lucide icons in feature code,
   since each ad-hoc import bloats the bundle.

## Theme switching

`ThemeProvider` resolves the active mode in this order:

1. `AsyncStorage['app.themeMode']` if it is `'light'` or `'dark'`.
2. `'system'` (default) → falls back to the OS-reported scheme via
   `useColorScheme()`.

Use `useThemeMode()` to read or change the override; changes persist
across app restarts.

## Showcase

`/dev/showcase` (open the kebab menu in any tab header in dev/preview
builds) shows every token swatch and component variant in both modes
— useful for catching contrast regressions or token drift before they
reach a feature screen.
