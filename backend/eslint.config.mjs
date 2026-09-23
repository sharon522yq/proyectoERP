import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      'no-unused-vars': 'off',
      'no-console': 'off',
      'no-undef': 'error',
      'eqeqeq': 'error',
      'curly': 'off',
      'no-shadow': 'warn',
      'no-restricted-globals': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
  {
    ignores: ['node_modules/**', 'tests/**', 'docs/**', 'dist/**', 'build/**'],
  },
];
