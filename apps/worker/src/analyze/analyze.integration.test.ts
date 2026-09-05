/**
 * `garment.analyze` against a REAL Postgres.
 *
 * What matters here cannot be mocked: that provenance is written for every
 * field, that only confident values reach the columns the closet renders, and
 * that a user's correction is never overwritten by a later analysis.
 *
 *   npm run db:up && npm run db:migrate && npm test
 */
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { RawModelResponse, VisionCapability } from '@mira/ai';
import { analyzeOneGarment, MAX_ATTEMPTS } from './runner.js';
import { enqueueAnalysis, STATEABLE } from './repository.js';

/**
 * A database of its own, never the development one.
 *
 * These tests write real rows and, in the worker's case, CLAIM QUEUED JOBS —
 * and job claiming is global by design. Run against the dev database with a
 * worker up, a test and the real worker race for the same job: whoever loses
 * sees it fail against the wrong storage root, which is exactly the
 * intermittent `unsupported_image_undecodable` that went unexplained twice.
 *
 *   npm run db:test:setup
 */
const DATABASE_URL =
  process.env['TEST_DATABASE_URL'] ?? 'postgresql://mira:mira@localhost:5433/mira_test';

let pool: pg.Pool | null = null;
let available = false;
let userId = '';
let closetId = '';

const logged: string[] = [];
const logger = {
  info: () => undefined,
  warn: (msg: string, fields?: Record<string, unknown>) =>
    logged.push(`warn: ${msg} ${JSON.stringify(fields ?? {})}`),
  error: (msg: string, fields?: Record<string, unknown>) =>
    logged.push(`error: ${msg} ${JSON.stringify(fields ?? {})}`),
};
const whatHappened = () => (logged.length ? logged.join('\n') : '(nothing logged)');

/** A vision provider that says exactly what a test needs it to say. */
function visionSaying(
  payload: unknown,
  overrides: Partial<RawModelResponse> = {},
): VisionCapability {
  return {
    async analyzeGarment(): Promise<RawModelResponse> {
      return {
        text: typeof payload === 'string' ? payload : JSON.stringify(payload),
        provider: 'test-provider',
        model: 'test-model',
        modelVersion: '7',
        ...overrides,
      };
    },
    readTag: async () => {
      throw new Error('not used');
    },
  };
}

const confidentDress = {
  category: 'dresses',
  subcategory: 'midi_dress',
  brand: 'Ganni',
  colors: ['black'],
  pattern: 'solid',
  materials: ['polyester'],
  season: ['spring'],
  occasion: ['dinner'],
  confidence: {
    category: 0.96,
    subcategory: 0.88,
    brand: 0.91,
    colors: 0.93,
    pattern: 0.9,
    // Below the stateable threshold on purpose.
    materials: 0.31,
    season: 0.7,
    occasion: 0.66,
  },
};

/** A garment as photo import leaves it: category `other`, analyzing. */
async function seedGarment(): Promise<{ garmentId: string; jobId: string }> {
  const garment = await pool!.query<{ id: string }>(
    `insert into garments (user_id, closet_id, category, source_type, analysis_state)
     values ($1, $2, 'other', 'camera', 'analyzing') returning id`,
    [userId, closetId],
  );
  const garmentId = garment.rows[0]!.id;

  await pool!.query(
    `insert into garment_images (garment_id, user_id, kind, storage_key, is_canonical, position)
     values ($1, $2, 'original', $3, true, 0)`,
    [garmentId, userId, `garments/${userId}/${garmentId}.jpg`],
  );

  await enqueueAnalysis(pool!, { userId, garmentId });
  const job = await pool!.query<{ id: string }>(
    `select id from ingestion_jobs
      where user_id = $1 and entity_id = $2 and job_type = 'garment.analyze'`,
    [userId, garmentId],
  );

  return { garmentId, jobId: job.rows[0]!.id };
}

const run = (vision: VisionCapability) =>
  analyzeOneGarment({ pool: pool!, vision, logger, onlyUserId: userId });

beforeAll(async () => {
  const candidate = new pg.Pool({ connectionString: DATABASE_URL, max: 4 });
  try {
    const { rows } = await candidate.query<{ count: string }>(
      "select count(*) as count from information_schema.tables where table_name = 'garment_attributes'",
    );
    if (rows[0]?.count === '0') throw new Error('run `npm run db:migrate`');
    pool = candidate;
    available = true;
  } catch {
    await candidate.end().catch(() => undefined);
    available = false;
    return;
  }

  await pool.query('delete from users where auth_provider_id = $1', ['analyze-it']);
  const user = await pool.query<{ id: string }>(
    `insert into users (auth_provider_id, email)
     values ('analyze-it', 'analyze-it@mira.local') returning id`,
  );
  userId = user.rows[0]!.id;

  const closet = await pool.query<{ id: string }>(
    `insert into closets (user_id, name) values ($1, 'Analyze') returning id`,
    [userId],
  );
  closetId = closet.rows[0]!.id;
});

afterAll(async () => {
  await pool
    ?.query('delete from users where auth_provider_id = $1', ['analyze-it'])
    .catch(() => undefined);
  await pool?.end();
});

beforeEach(async () => {
  logged.length = 0;
  if (!available || !pool) return;
  await pool.query('delete from ingestion_jobs where user_id = $1', [userId]);
  await pool.query('delete from garments where user_id = $1', [userId]);
});

const dbIt = (name: string, fn: () => Promise<void>) =>
  it(name, async () => {
    if (!available || !pool) {
      console.warn(`skipping "${name}": no migrated database at ${DATABASE_URL}`);
      return;
    }
    await fn();
  });

describe('analyzeOneGarment', () => {
  dbIt('reports nothing to do on an empty queue', async () => {
    expect(await run(visionSaying(confidentDress))).toBe(false);
  });

  dbIt('records every field with its own confidence and author', async () => {
    const { garmentId } = await seedGarment();
    expect(await run(visionSaying(confidentDress))).toBe(true);

    const { rows } = await pool!.query<{
      field: string;
      confidence: string;
      source: string;
      provider: string;
      model: string;
      model_version: string;
    }>(
      `select field, confidence, source, provider, model, model_version
         from garment_attributes where garment_id = $1 order by field`,
      [garmentId],
    );

    const byField = Object.fromEntries(rows.map((r) => [r.field, r]));
    expect(Number(byField['category']!.confidence)).toBeCloseTo(0.96, 2);
    // Kept even though it is too uncertain to display: this is what evaluation
    // measures and what a later model is compared against.
    expect(Number(byField['materials']!.confidence)).toBeCloseTo(0.31, 2);

    for (const row of rows) {
      expect(row.source).toBe('ai');
      expect(row.provider).toBe('test-provider');
      expect(row.model).toBe('test-model');
      expect(row.model_version).toBe('7');
    }
  });

  dbIt('states confident values on the garment, and withholds uncertain ones', async () => {
    const { garmentId } = await seedGarment();
    await run(visionSaying(confidentDress));

    const { rows } = await pool!.query<{
      category: string;
      brand_raw: string | null;
      pattern: string | null;
      materials: string[];
      analysis_state: string;
    }>(
      'select category, brand_raw, pattern, materials, analysis_state from garments where id = $1',
      [garmentId],
    );

    const garment = rows[0]!;
    expect(garment.category, whatHappened()).toBe('dresses');
    expect(garment.brand_raw).toBe('Ganni');
    expect(garment.pattern).toBe('solid');
    // 0.31 is below the stateable threshold: the closet renders flattened
    // values as fact, and this one would be a guess presented as a claim.
    expect(garment.materials).toEqual([]);
    expect(garment.analysis_state).toBe('complete');
  });

  dbIt('replaces the placeholder category from photo import', async () => {
    const { garmentId } = await seedGarment();
    await run(visionSaying(confidentDress));

    const { rows } = await pool!.query('select category from garments where id = $1', [garmentId]);
    // `other` was a placeholder (D-019), not an answer.
    expect(rows[0].category).toBe('dresses');
  });

  dbIt('records overall confidence as the weakest thing it will state', async () => {
    const { garmentId } = await seedGarment();
    await run(visionSaying(confidentDress));

    const { rows } = await pool!.query<{ ai_confidence: string }>(
      'select ai_confidence from garments where id = $1',
      [garmentId],
    );

    // The minimum of the stateable fields (occasion, 0.66) — a mean would let a
    // confident category paper over a weak brand.
    expect(Number(rows[0]!.ai_confidence)).toBeCloseTo(0.66, 2);
  });

  describe('degradation', () => {
    dbIt('keeps the garment when the model returns prose', async () => {
      const { garmentId, jobId } = await seedGarment();
      await run(visionSaying('This looks like a lovely black dress.'));

      const garment = await pool!.query(
        'select category, analysis_state from garments where id = $1',
        [garmentId],
      );
      // Category-only is a fallback, not a failure (§7).
      expect(garment.rows[0].category).toBe('other');
      expect(garment.rows[0].analysis_state).toBe('complete');

      const job = await pool!.query('select status from ingestion_jobs where id = $1', [jobId]);
      expect(job.rows[0].status).toBe('complete');
    });

    dbIt('marks the garment failed when the provider throws, and keeps it', async () => {
      const { garmentId } = await seedGarment();

      const broken: VisionCapability = {
        analyzeGarment: async () => {
          throw new Error('provider 503');
        },
        readTag: async () => {
          throw new Error('not used');
        },
      };

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) await run(broken);

      const { rows } = await pool!.query(
        'select analysis_state, deleted_at from garments where id = $1',
        [garmentId],
      );
      // §7: saves with analysis_state failed and a retry affordance. The
      // garment and its photo are still there.
      expect(rows[0].analysis_state).toBe('failed');
      expect(rows[0].deleted_at).toBeNull();
    });

    dbIt('gives up immediately on a garment with no images', async () => {
      const garment = await pool!.query<{ id: string }>(
        `insert into garments (user_id, closet_id, category, source_type, analysis_state)
         values ($1, $2, 'other', 'camera', 'analyzing') returning id`,
        [userId, closetId],
      );
      await enqueueAnalysis(pool!, { userId, garmentId: garment.rows[0]!.id });

      await run(visionSaying(confidentDress));

      const { rows } = await pool!.query<{ status: string; error_code: string; attempts: number }>(
        `select status, error_code, attempts from ingestion_jobs
          where entity_id = $1 and job_type = 'garment.analyze'`,
        [garment.rows[0]!.id],
      );
      expect(rows[0]!.status).toBe('failed');
      expect(rows[0]!.error_code).toBe('no_images');
      expect(rows[0]!.attempts).toBe(1);
    });
  });

  describe('the user always wins', () => {
    dbIt('never overwrites a field the user has set', async () => {
      const { garmentId } = await seedGarment();

      // The user names it before analysis lands.
      await pool!.query(
        `insert into garment_attributes (garment_id, user_id, field, value, confidence, source)
         values ($1, $2, 'brand', $3::jsonb, 1.0, 'user')`,
        [garmentId, userId, JSON.stringify('Toteme')],
      );
      await pool!.query(`update garments set brand_raw = 'Toteme' where id = $1`, [garmentId]);

      await run(visionSaying(confidentDress));

      const { rows } = await pool!.query('select brand_raw from garments where id = $1', [
        garmentId,
      ]);
      // Source precedence: user > everything (§3).
      expect(rows[0].brand_raw).toBe('Toteme');
    });

    dbIt('still records what the model said, so nothing is lost', async () => {
      const { garmentId } = await seedGarment();
      await pool!.query(
        `insert into garment_attributes (garment_id, user_id, field, value, confidence, source)
         values ($1, $2, 'brand', $3::jsonb, 1.0, 'user')`,
        [garmentId, userId, JSON.stringify('Toteme')],
      );

      await run(visionSaying(confidentDress));

      const { rows } = await pool!.query<{ value: string; source: string }>(
        `select value, source from garment_attributes
          where garment_id = $1 and field = 'brand' order by source`,
        [garmentId],
      );
      // Both survive: a correction never erases what the model said (AI-5).
      expect(rows.map((r) => r.source).sort()).toEqual(['ai', 'user']);
    });
  });

  dbIt('logs clamped values as a quality signal', async () => {
    await seedGarment();
    await run(
      visionSaying({
        ...confidentDress,
        occasion: ['brunching'],
        pattern: 'shimmery',
      }),
    );

    expect(logged.join('\n')).toContain('ai_taxonomy_clamped');
  });

  dbIt('is safe to run concurrently', async () => {
    await seedGarment();
    await seedGarment();
    await seedGarment();

    const results = await Promise.all(
      Array.from({ length: 4 }, () => run(visionSaying(confidentDress))),
    );
    expect(results.filter(Boolean)).toHaveLength(3);
  });
});

describe('STATEABLE', () => {
  it('is the medium band — what the product states rather than asks', () => {
    // Below this the review screen phrases a value as a question, so it must
    // not reach a column the closet renders as fact (D-022).
    expect(STATEABLE).toBe(0.6);
  });
});
