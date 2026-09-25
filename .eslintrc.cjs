module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    'no-console': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    // Seguranca: nunca logar process.env (risco de vazamento de secrets).
    // Ver docs/security/secret-policy.md
    'no-restricted-syntax': [
      'error',
      {
        selector:
          'CallExpression[callee.object.name="console"][arguments.0.object.name="process"][arguments.0.property.name="env"]',
        message:
          'NUNCA logar process.env. Risco de vazamento de secrets. Ver docs/security/secret-policy.md',
      },
    ],
  },
  ignorePatterns: [
    'packages/pumpfun/src/generated/**','dist/', 'node_modules/', 'coverage/', '*.js', '!.*.cjs', 'ml/', '.next/'],
};
