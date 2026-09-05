/**
 * The `image.process` loop.
 *
 * Work is claimed from `ingestion_jobs` rather than from a separate queue
 * (B-5). That table already exists as the user-visible mirror of the queue
 * (REL-3), it is written in the same transaction as the garment, and a queue
 * that can disagree with the job list the user is shown is a bug waiting to
 * happen. Postgres gives the claim safely through `for update skip locked`,
 * which is enough for the volumes Mira has; Redis buys throughput this does not
 * yet need at the cost of a second source of truth.
 */
import { UnsupportedImage } from './decode.js';
import { processImage, type ImageProcessPorts } from './process.js';
import { claimNextJob, recordFailure, recordResult, type ClaimedJob } from './repository.js';
import type { Pool } from 'pg';

/** Matches the queue's own policy in `queue.ts`. */
export const MAX_ATTEMPTS = 5;

export type RunnerLogger = {
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
};

export type RunnerDeps = {
  pool: Pool;
  ports: ImageProcessPorts;
  logger: RunnerLogger;
  /** Test-only scoping; see `ClaimOptions`. */
  onlyUserId?: string;
};

/**
 * Process one job. Returns false when there was nothing to do.
 *
 * Separated from the loop so tests can drive exactly one unit of work instead
 * of racing a timer.
 */
export async function processOneJob(deps: RunnerDeps): Promise<boolean> {
  const job = await claimNextJob(deps.pool, deps.onlyUserId ? { userId: deps.onlyUserId } : {});
  if (!job) return false;

  const started = Date.now();

  try {
    const report = await processImage(deps.ports, {
      garmentImageId: job.garmentImageId,
      uploadKey: job.uploadKey,
      userId: job.userId,
    });

    await recordResult(deps.pool, job, {
      width: report.width,
      height: report.height,
      blurhash: report.blurhash,
      imageHash: report.imageHash,
      // Absent when generation failed — the original serves in the meantime
      // (image-processing.md §8), so this must not become an error.
      thumbKey: report.derivatives.find((d) => d.name === 'thumb')?.storageKey ?? null,
      mediumKey: report.derivatives.find((d) => d.name === 'medium')?.storageKey ?? null,
      // Only an ACCEPTED cutout becomes canonical. A rejected one is discarded
      // and the original keeps the position (image-processing.md §3).
      cutoutStorageKey: report.cutout.status === 'accepted' ? report.cutout.storageKey : null,
    });

    deps.logger.info('image.process complete', {
      job_id: job.id,
      garment_image_id: job.garmentImageId,
      cutout: report.cutout.status,
      derivatives: report.derivatives.length,
      duration_ms: Date.now() - started,
    });
    return true;
  } catch (error) {
    await handleFailure(deps, job, error);
    return true;
  }
}

async function handleFailure(deps: RunnerDeps, job: ClaimedJob, error: unknown): Promise<void> {
  // An image we cannot decode will never become decodable. Retrying it burns
  // attempts and delays every job behind it.
  const permanent = error instanceof UnsupportedImage;

  const code = permanent ? `unsupported_image_${error.reason}` : 'image_process_failed';
  const message = error instanceof Error ? error.message : 'unknown error';

  await recordFailure(deps.pool, job, {
    code,
    message,
    retryable: !permanent,
    maxAttempts: MAX_ATTEMPTS,
  });

  deps.logger.warn('image.process failed', {
    job_id: job.id,
    garment_image_id: job.garmentImageId,
    error_code: code,
    attempt: job.attempts,
    permanent,
  });
}

export type LoopOptions = {
  /** How long to wait after finding nothing. */
  idleDelayMs?: number;
  /** Stop signal, so a deploy can drain rather than sever. */
  signal?: AbortSignal;
};

/**
 * Poll until stopped.
 *
 * Only sleeps when the queue is EMPTY: after processing a job it looks again
 * immediately, so a burst of captures drains at full speed instead of one photo
 * per interval.
 */
export async function runImageProcessLoop(
  deps: RunnerDeps,
  options: LoopOptions = {},
): Promise<void> {
  const idleDelayMs = options.idleDelayMs ?? 1_000;
  const { signal } = options;

  deps.logger.info('image.process worker started', { idle_delay_ms: idleDelayMs });

  while (!signal?.aborted) {
    let didWork = false;
    try {
      didWork = await processOneJob(deps);
    } catch (error) {
      // A failure to CLAIM (the database is down, say) must not kill the loop:
      // the jobs are still there and the database will come back.
      deps.logger.error('image.process loop error', {
        error: error instanceof Error ? error.message : 'unknown',
      });
    }

    if (!didWork) await sleep(idleDelayMs, signal);
  }

  deps.logger.info('image.process worker stopped');
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}
