import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  // Concurrent Vite servers must never replace each other's hashed shader chunks.
  cacheDir: mode === 'e2e' ? 'node_modules/.vite-e2e' : mode === 'test' ? 'node_modules/.vite-unit' : 'node_modules/.vite-dev',
  optimizeDeps: {
    entries: mode === 'e2e' ? ['index.html', 'tests/e2e/fixtures/*.html'] : ['index.html'],
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    environment: 'node',
  },
}));
