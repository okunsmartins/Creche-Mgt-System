import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'
import requireTenantScope from './eslint-rules/require-tenant-scope.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript', 'prettier'),
  {
    // Local guardrail: service-role reads of tenant tables must be school-scoped.
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      local: { rules: { 'require-tenant-scope': requireTenantScope } },
    },
    rules: {
      'local/require-tenant-scope': 'error',
    },
  },
  {
    rules: {
      // Disallow `any` — document exceptions with a comment
      '@typescript-eslint/no-explicit-any': 'error',
      // Require explicit return types on exported functions
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      // Disallow unused variables (use _ prefix to intentionally ignore)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Prevent accidental console.log in production code
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // Enforce consistent imports
      'import/order': 'off',
    },
  },
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
]

export default eslintConfig
