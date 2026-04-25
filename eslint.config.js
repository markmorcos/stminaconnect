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
