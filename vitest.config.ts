import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    preserveSymlinks: true,
  },
  test: {
    environment: 'node',
    pool: 'threads',
    include: ['tests/**/*.test.ts'],
  },
});
