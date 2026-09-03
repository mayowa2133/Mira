import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

/**
 * Mobile tests cover the React-free logic — form state, serialization and
 * filter state — which is where the rules that matter live. Component tests
 * need a simulator and arrive with the VoiceOver pass.
 */
export default defineConfig({
  test: { name: 'mobile', include: ['src/**/*.test.ts'] },
  resolve: {
    alias: { '@': resolve(import.meta.dirname, 'src') },
  },
});
