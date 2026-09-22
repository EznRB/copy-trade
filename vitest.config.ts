import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'packages/**/*.test.ts', 'services/**/*.test.ts', 'apps/**/*.test.ts', 'backtester/**/*.test.ts'],
    environment: 'node',
    coverage: { reporter: ['text', 'json'] },
  },
});
