import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'duplicates',
    include: ['src/**/*.test.ts'],
  },
});
