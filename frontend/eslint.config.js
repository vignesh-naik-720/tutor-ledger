// ESLint flat config for the frontend (T025). Bans dangerouslySetInnerHTML.
import reactPlugin from 'eslint-plugin-react';

export default [
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: { react: reactPlugin },
    rules: {
      'react/no-danger': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
];
