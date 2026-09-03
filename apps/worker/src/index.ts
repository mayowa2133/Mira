/**
 * Mira worker entrypoint.
 *
 * Deployed independently of the API, so a stuck queue never requires an API
 * deploy (`docs/08-engineering/deployment.md` — Backend).
 */
import { createInMemoryQueue } from './queue.js';
import { JOB_TYPES } from './jobs.js';

function main(): void {
  const queue = createInMemoryQueue();

  // Processors are registered by the pipelines they serve, starting in Phase 2.
  // Until then the worker starts, reports what it can run, and stays idle.
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      level: 'info',
      time: new Date().toISOString(),
      msg: 'worker started',
      service: 'mira-worker',
      registered_job_types: 0,
      known_job_types: JOB_TYPES.length,
    }),
  );

  void queue;
}

main();
