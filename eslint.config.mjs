import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  ...compat.extends('prettier'),
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/.pnpm-store/**',
      '**/archive/**',
      '**/convex/_generated/**',
      '**/*.generated.*',
      '**/coverage/**',
      '**/.eslintcache',
    ],
    rules: {
      // Import rules for unused imports - these are not auto-fixable
      '@typescript-eslint/no-unused-vars': 'error',
      // Disable useEffect dependency warnings (manual fixes only)
      'react-hooks/exhaustive-deps': 'off',
      // Auto-fixable rules
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      // Additional auto-fixable rules
      'no-trailing-spaces': 'error',
      'eol-last': 'error',
      'comma-dangle': ['error', 'always-multiline'],
    },
  },
];

export default eslintConfig;
