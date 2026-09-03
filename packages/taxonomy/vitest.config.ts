import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'taxonomy',
    include: ['src/**/*.test.ts'],
  },
});
