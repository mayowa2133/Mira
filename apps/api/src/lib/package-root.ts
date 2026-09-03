import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Absolute path to this package's root, whether running from `src/` (tests) or
 * `dist/` (built).
 *
 * Needed because non-TypeScript assets — the `.sql` migrations — are SOURCE,
 * not build output. `tsc` does not copy them, and resolving them relative to
 * the calling module would break the moment the code is compiled.
 */
export function packageRoot(moduleUrl: string): string {
  let dir = dirname(fileURLToPath(moduleUrl));
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(resolve(dir, 'package.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`could not locate a package root above ${moduleUrl}`);
}
