import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'imaging',
    include: ['src/**/*.test.ts'],
  },
});
