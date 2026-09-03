import { isAbsolute, resolve } from 'node:path';
import { packageRoot } from './package-root.js';

/**
 * Resolve the local storage root.
 *
 * A relative `STORAGE_LOCAL_ROOT` is resolved against the API PACKAGE root, not
 * the working directory. The server runs from `apps/api` and the seed runs from
 * the repository root, so a cwd-relative default silently gives them two
 * different directories — the seed writes images the server can never find.
 */
export function resolveStorageRoot(configured: string): string {
  return isAbsolute(configured) ? configured : resolve(packageRoot(import.meta.url), configured);
}
