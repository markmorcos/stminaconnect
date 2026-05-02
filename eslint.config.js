const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'web-build/**',
      'coverage/**',
      'android/**',
      'ios/**',
      'supabase/.temp/**',
      // Edge Functions are Deno code; their `https://...` imports and
      // `Deno` globals don't resolve under the Node ESLint config.
      // They're type-checked via excluded tsconfig + tested via `deno test`.
      'supabase/functions/**',
      // marketing/ contains a Deno-based legal-page renderer (npm:
      // specifiers, `Deno` global). Excluded for the same reason.
      'marketing/**',
      'Makefile',
      '**/*.md',
    ],
  },
  ...expoConfig,
  prettierConfig,
  {
    settings: {
      react: { version: '19.1' },
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['jest.setup.ts', 'jest.setup.before.js', 'jest.config.js', 'babel.config.js', 'Makefile'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];
