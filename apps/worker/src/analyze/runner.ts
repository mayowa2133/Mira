/**
 * The `garment.analyze` loop.
 *
 * Claims from `ingestion_jobs` exactly as `image.process` does (D-020), and is
 * governed by the same rule: the garment already exists, so nothing here can
 * lose it (REL-4). A provider outage leaves a garment that shows its photo and
 * says it could not be analyzed — never a garment that vanished.
 */
import { CONFIDENCE, confidenceBand } from '@mira/taxonomy';
import { toAttributes, understandWithRetry, type VisionCapability } from '@mira/ai';
import type { Pool } from 'pg';
import {
  claimNextAnalyzeJob,
  imagesFor,
  recordAnalysis,
  recordAnalyzeFailure,
  type AnalyzeJob,
} from './repository.js';

export const MAX_ATTEMPTS = 3;

export type AnalyzeLogger = {
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
};

export type AnalyzeDeps = {
  pool: Pool;
  vision: VisionCapability;
  logger: AnalyzeLogger;
  /** Test-only scoping; the claim is otherwise global. */
  onlyUserId?: string;
};

/**
 * Overall confidence for the garment.
 *
 * The MINIMUM of the fields the product will state, not the mean. A mean lets a
 * confident category paper over a guessed brand, and `ai_confidence` is what
 * decides whether Mira presents this garment as understood.
 */
function overallConfidence(confidences: number[]): number | null {
  const stateable = confidences.filter((value) => value >= CONFIDENCE.medium);
  if (stateable.length === 0) return null;
  return Math.min(...stateable);
}

export async function analyzeOneGarment(deps: AnalyzeDeps): Promise<boolean> {
  const job = await claimNextAnalyzeJob(
    deps.pool,
    deps.onlyUserId ? { userId: deps.onlyUserId } : {},
  );
  if (!job) return false;

  const started = Date.now();

  try {
    const images = await imagesFor(deps.pool, job);
    if (images.length === 0) {
      // Nothing to look at. Retrying will not produce an image.
      await recordAnalyzeFailure(deps.pool, job, {
        code: 'no_images',
        message: 'the garment has no images to analyze',
        retryable: false,
        maxAttempts: MAX_ATTEMPTS,
      });
      return true;
    }

    const { outcome, provenance } = await understandWithRetry(() =>
      deps.vision.analyzeGarment({
        images: images.map((image) => ({
          storageKey: image.storageKey,
          imageHash: image.imageHash ?? undefined,
        })),
      }),
    );

    const attributes = toAttributes(outcome.value);

    await recordAnalysis(deps.pool, job, {
      understanding: outcome.value,
      attributes,
      provenance,
      overall: overallConfidence(attributes.map((a) => a.confidence)),
      // A degraded response is still an ANSWER — §7 calls category-only a
      // fallback, not a failure — so the garment is complete and the user can
      // fill in the rest, or ask for a re-analysis.
      analysisState: 'complete',
    });

    if (outcome.status === 'understood' && outcome.drops.length > 0) {
      // A rise here is a prompt or model regression, not a user problem.
      deps.logger.warn('ai_taxonomy_clamped', {
        garment_id: job.garmentId,
        provider: provenance.provider,
        model: provenance.model,
        dropped: outcome.drops.map((drop) => `${drop.field}:${drop.reason}`),
      });
    }

    deps.logger.info('garment.analyze complete', {
      job_id: job.id,
      garment_id: job.garmentId,
      status: outcome.status,
      fields: attributes.length,
      category_band: confidenceBand(outcome.value.confidence['category'] ?? 0),
      duration_ms: Date.now() - started,
    });
    return true;
  } catch (error) {
    await handleFailure(deps, job, error);
    return true;
  }
}

async function handleFailure(deps: AnalyzeDeps, job: AnalyzeJob, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : 'unknown error';

  // A provider outage is transient by nature; everything else gets the same
  // benefit of the doubt until attempts run out.
  await recordAnalyzeFailure(deps.pool, job, {
    code: 'garment_analyze_failed',
    message,
    retryable: true,
    maxAttempts: MAX_ATTEMPTS,
  });

  deps.logger.warn('garment.analyze failed', {
    job_id: job.id,
    garment_id: job.garmentId,
    attempt: job.attempts,
    error: message,
  });
}

export type AnalyzeLoopOptions = {
  idleDelayMs?: number;
  signal?: AbortSignal;
};

export async function runAnalyzeLoop(
  deps: AnalyzeDeps,
  options: AnalyzeLoopOptions = {},
): Promise<void> {
  const idleDelayMs = options.idleDelayMs ?? 1_000;
  const { signal } = options;

  deps.logger.info('garment.analyze worker started', { idle_delay_ms: idleDelayMs });

  while (!signal?.aborted) {
    let didWork = false;
    try {
      didWork = await analyzeOneGarment(deps);
    } catch (error) {
      deps.logger.error('garment.analyze loop error', {
        error: error instanceof Error ? error.message : 'unknown',
      });
    }

    if (!didWork) await sleep(idleDelayMs, signal);
  }

  deps.logger.info('garment.analyze worker stopped');
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}
