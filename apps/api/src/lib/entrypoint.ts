import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** True when this module was run directly, rather than imported. */
export function isEntrypoint(moduleUrl: string): boolean {
  const invoked = process.argv[1];
  if (!invoked) return false;
  try {
    return realpathSync(invoked) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}
