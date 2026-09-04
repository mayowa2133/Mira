/**
 * The account-deletion loop.
 *
 * Polls its own table rather than `ingestion_jobs` (D-031), and runs alongside
 * the other loops so a slow vision provider cannot delay someone's deletion —
 * which is the one piece of work here with a promise attached to it.
 */
import { runOneDeletion, type DeletionDeps } from './delete-account.js';

/** Deletions are rare; polling hard would be all cost and no benefit. */
const IDLE_MS = 5_000;

export async function runDeletionLoop(
  deps: DeletionDeps,
  options: { signal: AbortSignal },
): Promise<void> {
  while (!options.signal.aborted) {
    let did = false;
    try {
      did = await runOneDeletion(deps);
    } catch (error) {
      // The loop must survive anything a single request can throw, or one bad
      // record stops every other deletion behind it.
      deps.logger.error('deletion loop error', {
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
    if (!did) await new Promise((resolve) => setTimeout(resolve, IDLE_MS));
  }
}
