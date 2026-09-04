/**
 * Persistence for `garment.analyze`.
 *
 * Two places receive the result, and the split is the point:
 *
 * - `garment_attributes` gets EVERY field the model produced, with its own
 *   confidence, provider and model. Nothing is thrown away, so a correction
 *   never erases what the model said (AI-1, AI-5) and evaluation has something
 *   to measure later.
 * - `garments` gets only the values the product is willing to STATE. The closet
 *   grid renders flattened values as fact, with no room for a confidence band,
 *   so a value the review screen would have phrased as a question must not
 *   arrive there as an assertion (D-022).
 */
import type { Pool } from 'pg';
import { CONFIDENCE } from '@mira/taxonomy';
import type { AttributeValue, ClampedUnderstanding, Provenance } from '@mira/ai';

export type AnalyzeJob = {
  id: string;
  userId: string;
  garmentId: string;
  attempts: number;
};

export type GarmentImageRef = {
  storageKey: string;
  imageHash: string | null;
  isCanonical: boolean;
};

/** Claim the next queued `garment.analyze` job. See image/repository.ts. */
export async function claimNextAnalyzeJob(
  pool: Pool,
  options: { userId?: string } = {},
): Promise<AnalyzeJob | null> {
  const client = await pool.connect();
  try {
    await client.query('begin');

    const { rows } = await client.query<{
      id: string;
      user_id: string;
      entity_id: string;
      attempts: number;
    }>(
      `update ingestion_jobs
          set status = 'running', attempts = attempts + 1, started_at = now()
        where id = (
          select id from ingestion_jobs
           where status = 'queued'
             and job_type = 'garment.analyze'
             and ($1::uuid is null or user_id = $1::uuid)
           order by created_at
           for update skip locked
           limit 1
        )
        returning id, user_id, entity_id, attempts`,
      [options.userId ?? null],
    );

    const job = rows[0];
    if (!job) {
      await client.query('commit');
      return null;
    }

    const garment = await client.query<{ id: string }>(
      `select id from garments
        where user_id = $1 and id = $2 and deleted_at is null`,
      [job.user_id, job.entity_id],
    );

    if (!garment.rows[0]) {
      await client.query(
        `update ingestion_jobs
            set status = 'failed', error_code = 'garment_missing',
                error_message = 'the garment no longer exists', finished_at = now()
          where id = $1`,
        [job.id],
      );
      await client.query('commit');
      return null;
    }

    await client.query('commit');
    return {
      id: job.id,
      userId: job.user_id,
      garmentId: job.entity_id,
      attempts: job.attempts,
    };
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * The images to analyze, canonical first.
 *
 * §2: the cleaned cutout is the primary signal and the original gives context.
 * Ordering matters because a provider reads them in order.
 */
export async function imagesFor(
  pool: Pool,
  job: AnalyzeJob,
): Promise<GarmentImageRef[]> {
  const { rows } = await pool.query<{
    storage_key: string;
    image_hash: string | null;
    is_canonical: boolean;
  }>(
    `select storage_key, image_hash, is_canonical
       from garment_images
      where user_id = $1 and garment_id = $2 and deleted_at is null
      order by is_canonical desc, position`,
    [job.userId, job.garmentId],
  );

  return rows.map((row) => ({
    storageKey: row.storage_key,
    imageHash: row.image_hash,
    isCanonical: row.is_canonical,
  }));
}

/**
 * Values confident enough for the closet to state as fact.
 *
 * `docs/06-ai/ai-product-spec.md` §3 bands: high and medium are STATED to the
 * user; low is asked as a question and very low is not shown at all. The
 * flattened columns on `garments` are what the grid and detail screens render,
 * with no band attached — so anything the review screen would have phrased as a
 * question must not appear there as a claim (D-022).
 */
export const STATEABLE = CONFIDENCE.medium;

/** Fields on `garments` that analysis may fill in, and their column names. */
const FLATTENED: Record<string, string> = {
  category: 'category',
  subcategory: 'subcategory',
  brand: 'brand_raw',
  // The FIRST colour is the primary one (garment-understanding.md §1: "Ordered,
  // first is primary"). Its absence here meant analysis threw away a colour it
  // was 0.92 confident about, and left tiles with nothing to say about
  // themselves.
  pattern: 'pattern',
  fit: 'fit',
  sleeve_length: 'sleeve_length',
  neckline: 'neckline',
  length: 'length',
  materials: 'materials',
  style: 'style_tags',
  season: 'season',
  occasion: 'occasion',
};

export type AnalyzeResult = {
  understanding: ClampedUnderstanding;
  attributes: AttributeValue[];
  provenance: Provenance;
  /** Overall confidence for the garment; null when nothing was confident. */
  overall: number | null;
  analysisState: 'complete' | 'failed';
};

/**
 * Record an analysis.
 *
 * One transaction: a garment whose attributes were written but whose
 * `analysis_state` was not is a garment stuck saying "analyzing" forever, and
 * one whose state advanced without its values is a garment that claims to know
 * things it cannot show.
 */
export async function recordAnalysis(
  pool: Pool,
  job: AnalyzeJob,
  result: AnalyzeResult,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('begin');

    // Provenance for everything, regardless of confidence. A value too
    // uncertain to display is still worth keeping — it is what evaluation
    // measures and what a later model is compared against.
    for (const attribute of result.attributes) {
      await client.query(
        `insert into garment_attributes
           (garment_id, user_id, field, value, confidence, source,
            provider, model, model_version)
         values ($2, $1, $3, $4::jsonb, $5, 'ai', $6, $7, $8)`,
        [
          job.userId,
          job.garmentId,
          attribute.field,
          JSON.stringify(attribute.value),
          attribute.confidence,
          result.provenance.provider,
          result.provenance.model,
          result.provenance.modelVersion,
        ],
      );
    }

    await flattenConfidentValues(client, job, result);

    await client.query(
      `update garments
          set analysis_state = $3, ai_confidence = $4
        where user_id = $1 and id = $2`,
      [job.userId, job.garmentId, result.analysisState, result.overall],
    );

    await client.query(
      `update ingestion_jobs
          set status = 'complete', finished_at = now(),
              error_code = null, error_message = null
        where id = $1`,
      [job.id],
    );

    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Write the confident values onto the garment itself.
 *
 * A user value is never overwritten (§3, source precedence). This only fills a
 * column that analysis has a right to fill: one still holding what photo import
 * created, never one the user has touched.
 */
async function flattenConfidentValues(
  client: { query: Pool['query'] },
  job: AnalyzeJob,
  result: AnalyzeResult,
): Promise<void> {
  const assignments: string[] = [];
  const values: unknown[] = [job.userId, job.garmentId];

  for (const attribute of result.attributes) {
    if (attribute.confidence < STATEABLE) continue;

    for (const { field, column } of columnsFor(attribute.field)) {
      values.push(columnValue(field, attribute.value));
      assignments.push(`${column} = $${values.length}`);
    }
  }

  if (assignments.length === 0) return;

  await client.query(
    `update garments set ${assignments.join(', ')}
      where user_id = $1 and id = $2
        and not exists (
          select 1 from garment_attributes
           where garment_id = $2 and source = 'user'
        )`,
    values,
  );
}

/**
 * Which columns an attribute fills.
 *
 * Usually one. The colour list fills two, because `garments` stores a primary
 * colour and the rest separately — the model returns them ordered, first is
 * primary (garment-understanding.md §1).
 */
function columnsFor(field: string): { field: string; column: string }[] {
  if (field === 'colors') {
    return [
      { field: 'colors', column: 'primary_color' },
      { field: 'secondary_colors', column: 'secondary_colors' },
    ];
  }

  const column = FLATTENED[field];
  return column ? [{ field, column }] : [];
}

/** Arrays stay arrays; the colour list becomes a primary plus the rest. */
function columnValue(field: string, value: unknown): unknown {
  if (field === 'materials' || field === 'style' || field === 'season' || field === 'occasion') {
    return Array.isArray(value) ? value : [];
  }
  if (field === 'colors') {
    return Array.isArray(value) ? (value[0] ?? null) : null;
  }
  if (field === 'secondary_colors') {
    return Array.isArray(value) ? value.slice(1) : [];
  }
  return value;
}

/** Give the job back, or give up on it. */
export async function recordAnalyzeFailure(
  pool: Pool,
  job: AnalyzeJob,
  options: { code: string; message: string; retryable: boolean; maxAttempts: number },
): Promise<void> {
  const exhausted = !options.retryable || job.attempts >= options.maxAttempts;

  const client = await pool.connect();
  try {
    await client.query('begin');

    await client.query(
      `update ingestion_jobs
          set status = $2, error_code = $3, error_message = $4,
              finished_at = case when $2 = 'failed' then now() else null end
        where id = $1`,
      [job.id, exhausted ? 'failed' : 'queued', options.code, options.message.slice(0, 500)],
    );

    if (exhausted) {
      // §7: the garment saves with `analysis_state: failed` and a retry
      // affordance. It keeps its photo and its place in the closet.
      await client.query(
        `update garments set analysis_state = 'failed'
          where user_id = $1 and id = $2`,
        [job.userId, job.garmentId],
      );
    }

    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Queue analysis for a garment whose imagery is ready. */
export async function enqueueAnalysis(
  pool: Pool,
  input: { userId: string; garmentId: string },
): Promise<void> {
  await pool.query(
    `insert into ingestion_jobs (user_id, job_type, entity_type, entity_id)
     values ($1, 'garment.analyze', 'garment', $2)`,
    [input.userId, input.garmentId],
  );
}
