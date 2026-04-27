/**
 * Single source of truth for the dev-tools visibility flag — extracted
 * so tests can mock it per-scenario without `jest.resetModules()`,
 * which would tear down React's module-internal context and break
 * hooks. Production builds set neither and this returns false.
 */
export const SHOW_DEV_TOOLS = __DEV__ || process.env.EXPO_PUBLIC_SHOW_DEV_TOOLS === 'true';
