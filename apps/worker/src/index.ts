/**
 * Mira worker entrypoint.
 *
 * Deployed independently of the API, so a stuck queue never requires an API
 * deploy (`docs/08-engineering/deployment.md` — Backend).
 */
import { Pool } from 'pg';
import { createLocalStorage, isSafeStorageKey } from '@mira/storage';
import { stubProviders } from '@mira/ai';
import { JOB_TYPES } from './jobs.js';
import { runImageProcessLoop } from './image/runner.js';
import { runAnalyzeLoop } from './analyze/runner.js';
import { runDeletionLoop } from './deletion/runner.js';
import type { ImageProcessPorts } from './image/process.js';
import { derivedKey } from './image/keys.js';

function log(level: 'info' | 'warn' | 'error', msg: string, fields: Record<string, unknown> = {}) {
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      level,
      time: new Date().toISOString(),
      msg,
      service: 'mira-worker',
      ...fields,
    }),
  );
}

const logger = {
  info: (msg: string, fields?: Record<string, unknown>) => log('info', msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => log('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => log('error', msg, fields),
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: required('DATABASE_URL'), max: 4 });

  const storage = createLocalStorage({
    root: required('STORAGE_LOCAL_ROOT'),
    secret: required('STORAGE_SIGNING_SECRET'),
    publicBaseUrl: `${process.env['API_BASE_URL'] ?? 'http://localhost:4000'}/v1`,
  });

  const ports: ImageProcessPorts = {
    async read(storageKey) {
      // The key comes from a row the job identified, but a traversing key must
      // never be resolvable regardless of where it came from.
      if (!isSafeStorageKey(storageKey)) return null;
      return storage.get(storageKey);
    },
    async write(storageKey, bytes) {
      if (!isSafeStorageKey(storageKey)) throw new Error('refusing to write an unsafe key');
      await storage.put(storageKey, bytes);
    },
    derivedKey,
    // Segmentation has no provider yet, and the stub returns null — which is a
    // real, specified path: the original stays canonical and the garment is
    // unaffected (`ai-fallbacks.md` — Segmentation).
    segmentation: stubProviders.segmentation,
  };

  const controller = new AbortController();

  const shutdown = (signal: string) => {
    logger.info('shutting down', { signal });
    controller.abort();
    void pool.end().then(() => process.exit(0));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  logger.info('worker started', {
    registered_job_types: 3,
    known_job_types: JOB_TYPES.length,
  });

  // Both loops run in one process and poll independently, so a slow vision
  // provider cannot stall image processing behind it.
  await Promise.all([
    runImageProcessLoop({ pool, ports, logger }, { signal: controller.signal }),
    runAnalyzeLoop({ pool, vision: stubProviders.vision, logger }, { signal: controller.signal }),
    // Deletion runs beside them, not behind them: it is the one piece of work
    // here that a user is waiting on a promise about.
    runDeletionLoop(
      {
        pool,
        storage,
        // No identity provider is configured, so a deletion cannot complete its
        // final step and will retry. That is the honest behaviour — the
        // alternative is marking an account deleted while its provider
        // identity still exists (D-030).
        identity: {
          deleteIdentity: () => Promise.reject(new Error('no identity provider configured')),
        },
        logger,
      },
      { signal: controller.signal },
    ),
  ]);
}

main().catch((error: unknown) => {
  logger.error('worker failed to start', {
    error: error instanceof Error ? error.message : 'unknown',
  });
  process.exit(1);
});
