export const colors = {
  // Primary
  primary: "#1B2A4A",
  primaryLight: "#2D4470",
  gold: "#C8952E",
  goldDark: "#9E7424",

  // Secondary
  burgundy: "#7A2D3B",
  burgundyLight: "#9C4055",
  sand: "#F5F0E8",
  sandDark: "#EDE5D8",

  // Neutrals
  ink: "#1A1A2E",
  inkSecondary: "#4A4A5A",
  inkTertiary: "#7A7A8A",
  border: "#D4CFC5",
  surface: "#FFFFFF",
  background: "#F5F0E8",

  // Semantic
  present: "#2D7D46",
  presentBg: "#E8F5EC",
  absent: "#C4392D",
  absentBg: "#FDECEA",
  atRisk: "#B8860B",
  atRiskBg: "#FFF3E0",
  info: "#2B6CB0",
  infoBg: "#EBF4FF",

  // Common
  white: "#FFFFFF",
  black: "#000000",
  transparent: "transparent",
} as const;

export const darkColors = {
  background: "#0F1520",
  surface: "#1A2233",
  surfaceElevated: "#243044",
  border: "#2E3D55",
  textPrimary: "#EDEBE8",
  textSecondary: "#A8A4A0",
} as const;

export type ColorToken = keyof typeof colors;
export type DarkColorToken = keyof typeof darkColors;
