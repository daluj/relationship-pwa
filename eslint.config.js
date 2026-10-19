import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'coverage', 'playwright-report', 'test-results'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended, prettier],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  // SPEC §4: domain/ is pure TS — no React, no Dexie.
  {
    files: ['src/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-*', 'dexie', 'dexie-*'],
              message: 'domain/ must stay pure (SPEC §4).',
            },
            {
              group: ['@/db/*', '@/features/*', '@/app/*', '@/components/*'],
              message: 'domain/ must not depend on app layers.',
            },
          ],
        },
      ],
    },
  },
  // SPEC §4: UI never touches Dexie directly — go through db/repositories.
  {
    files: ['src/features/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}', 'src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['dexie', 'dexie-react-hooks'],
              message: 'Use db/repositories instead of Dexie (SPEC §4).',
            },
            {
              group: ['@/db/db', '@/db/schema'],
              message: 'Use db/repositories instead (SPEC §4).',
            },
          ],
        },
      ],
    },
  },
);
