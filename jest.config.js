module.exports = {
  preset: 'jest-expo',
  setupFiles: [
    '<rootDir>/jest.setup.before.js',
    require.resolve('jest-expo/src/preset/setup.js'),
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
  // Edge Functions live in `supabase/functions/**` and are Deno code —
  // their `*.test.ts` files use `https://deno.land/...` imports that
  // Jest cannot resolve. They run via `deno test` instead.
  testPathIgnorePatterns: ['/node_modules/', '/supabase/functions/'],
  // Thresholds are intentionally low at scaffolding time — raised to lines: 80,
  // branches: 70 once business-logic capabilities (auth, attendance, …) land.
  coverageThreshold: {
    global: {
      lines: 0,
      branches: 0,
      functions: 0,
      statements: 0,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
