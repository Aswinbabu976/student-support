import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['src/tests/setup.ts'],
    fileParallelism: false,
    testTimeout: 20000,
  },
});
