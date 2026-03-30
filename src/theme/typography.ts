export const fontFamily = {
  regular: "Cairo_400Regular",
  medium: "Cairo_500Medium",
  semiBold: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
} as const;

export const fontSize = {
  display: 28,
  h1: 24,
  h2: 20,
  h3: 18,
  bodyLarge: 17,
  body: 15,
  bodySmall: 13,
  caption: 12,
  button: 16,
  tabLabel: 12,
} as const;

export const lineHeight = {
  display: 36,
  h1: 32,
  h2: 28,
  h3: 24,
  bodyLarge: 26,
  body: 24,
  bodySmall: 20,
  caption: 16,
  button: 20,
  tabLabel: 16,
} as const;

// Arabic text needs extra line height for diacritical marks
export const ARABIC_LINE_HEIGHT_MULTIPLIER = 1.1;
