module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'security', 'react'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:security/recommended',
    'plugin:react/recommended',
  ],
  settings: { react: { version: 'detect' } },
  rules: {
    'react/no-danger': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
  },
  ignorePatterns: ['dist/', 'node_modules/', 'coverage/'],
};
