import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "St. Mina Connect",
  slug: "stminaconnect",
  version: "1.0.0",
  owner: "markmorcos",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  scheme: "stminaconnect",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#1B2A4A",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "tech.morcos.stminaconnect",
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#1B2A4A",
    },
    package: "tech.morcos.stminaconnect",
    edgeToEdgeEnabled: true,
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-localization",
    [
      "expo-font",
      {
        fonts: ["node_modules/@expo-google-fonts/cairo/Cairo_400Regular.ttf"],
      },
    ],
  ],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: {
      projectId: "709cf095-c8d1-4a89-b897-ee734c8d8acd",
    },
  },
});
