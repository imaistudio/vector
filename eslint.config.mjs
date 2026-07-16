import convexPlugin from '@convex-dev/eslint-plugin';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import prettier from 'eslint-config-prettier/flat';
import unusedImports from 'eslint-plugin-unused-imports';

const eslintConfig = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'dist/**',
      'out/**',
      'build/**',
      '.pnpm-store/**',
      'archive/**',
      'coverage/**',
      '.eslintcache',
      'next-env.d.ts',
      'convex/**/_generated/**',
      '**/*.generated.*',
    ],
  },
  ...nextCoreWebVitals,
  ...convexPlugin.configs.recommended,
  prettier,
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      'unused-imports': unusedImports,
    },
    rules: {
      'max-lines': [
        'warn',
        { max: 2000, skipBlankLines: true, skipComments: true },
      ],
      'comma-dangle': 'off',
      '@typescript-eslint/comma-dangle': 'off',
      // Type-aware promise checking is handled by Oxlint/tsgolint. Keeping it
      // out of ESLint avoids starting a second TypeScript project service.
      '@typescript-eslint/no-floating-promises': 'off',
      // Next 16.2 enables newer React Compiler lint rules through the
      // core-web-vitals preset. Keep the upgrade behavior-compatible for now;
      // these existing patterns need a dedicated cleanup pass.
      'react-hooks/error-boundaries': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',
      'unused-imports/no-unused-imports': 'warn',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: ['convex/**/*.ts', 'convex/**/*.tsx'],
    rules: {
      '@convex-dev/explicit-table-ids': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression',
          message:
            'Dynamic imports are not allowed in convex files. Use regular imports instead.',
        },
      ],
    },
  },
];

export default eslintConfig;
