// Config exclusivo para rodar os PoCs do red-team sem alterar vitest.config.ts do projeto.
// Uso: npx vitest run --config docs/security/red-team/poc/vitest.poc.config.mjs
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['docs/security/red-team/poc/**/*.test.ts'],
  },
});
