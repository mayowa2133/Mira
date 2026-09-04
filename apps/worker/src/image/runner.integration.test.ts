/**
 * `image.process` against a REAL Postgres.
 *
 * The parts worth testing here are the ones a mocked pool cannot reach: that
 * two workers never claim the same job, that the canonical swap holds under a
 * unique index, and that a job which fails permanently stops being retried.
 *
 *   npm run db:up && npm run db:migrate && npm test
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createLocalStorage, buildStorageKey, type StorageDriver } from '@mira/storage';
import { processOneJob, MAX_ATTEMPTS } from './runner.js';
import type { ImageProcessPorts } from './process.js';
import { derivedKey } from './keys.js';

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
const storageRoot = mkdtempSync(join(tmpdir(), 'mira-worker-it-'));

let pool: pg.Pool | null = null;
let storage: StorageDriver | null = null;
let available = false;

let userId = '';
let closetId = '';

/**
 * Records instead of discarding.
 *
 * A silent logger cost real time once: a test failed with "1 row, expected 2"
 * and the reason — the error the runner had caught and logged — was thrown
 * away. Assertions below surface these lines so a failure explains itself.
 */
const logged: string[] = [];
const logger = {
  info: () => undefined,
  warn: (msg: string, fields?: Record<string, unknown>) =>
    logged.push(`warn: ${msg} ${JSON.stringify(fields ?? {})}`),
  error: (msg: string, fields?: Record<string, unknown>) =>
    logged.push(`error: ${msg} ${JSON.stringify(fields ?? {})}`),
};

/** What the runner reported during this test, for failure messages. */
const whatHappened = () => (logged.length ? logged.join('\n') : '(the runner logged nothing)');

function portsWith(overrides: Partial<ImageProcessPorts> = {}): ImageProcessPorts {
  return {
    read: async (key) => storage!.get(key),
    write: async (key, bytes) => storage!.put(key, bytes),
    // The real one. A test that reimplements this diverged from production and
    // hid a key collision that overwrote every capture's derivatives.
    derivedKey,
    segmentation: { cutout: async () => null },
    ...overrides,
  };
}

async function photo(): Promise<Buffer> {
  const w = 600;
  const h = 800;
  const raw = Buffer.alloc(w * h * 3, 235);
  for (let y = 120; y < 680; y += 1) {
    for (let x = 180; x < 420; x += 1) {
      const at = (y * w + x) * 3;
      raw[at] = 40;
      raw[at + 1] = 38;
      raw[at + 2] = 52;
    }
  }
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } })
    .jpeg()
    .toBuffer();
}

/** A cutout that will pass the quality gate. */
async function goodCutout(): Promise<Buffer> {
  const w = 400;
  const h = 500;
  const raw = Buffer.alloc(w * h * 4, 0);
  for (let y = 75; y < 425; y += 1) {
    for (let x = 120; x < 280; x += 1) {
      const at = (y * w + x) * 4;
      raw[at] = 40;
      raw[at + 1] = 38;
      raw[at + 2] = 52;
      raw[at + 3] = 255;
    }
  }
  return sharp(raw, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toBuffer();
}

/** A garment with an original image and a queued image.process job. */
async function seedCapture(options: { bytes?: Buffer | null } = {}) {
  const garment = await pool!.query<{ id: string }>(
    `insert into garments (user_id, closet_id, category, source_type, analysis_state)
     values ($1, $2, 'other', 'camera', 'analyzing') returning id`,
    [userId, closetId],
  );
  const garmentId = garment.rows[0]!.id;

  // The shape the API actually issues: flat under the user, not nested per
  // garment. Using a nested key here is what let the collision through.
  const key = buildStorageKey('garments', userId, `${Date.now()}-${garmentId}.jpg`);
  const bytes = options.bytes === undefined ? await photo() : options.bytes;
  if (bytes) await storage!.put(key, bytes);

  const image = await pool!.query<{ id: string }>(
    `insert into garment_images
       (garment_id, user_id, kind, storage_key, is_canonical, position)
     values ($1, $2, 'original', $3, true, 0) returning id`,
    [garmentId, userId, key],
  );
  const imageId = image.rows[0]!.id;

  const job = await pool!.query<{ id: string }>(
    `insert into ingestion_jobs (user_id, job_type, entity_type, entity_id)
     values ($1, 'image.process', 'garment_image', $2) returning id`,
    [userId, imageId],
  );

  return { garmentId, imageId, jobId: job.rows[0]!.id, key };
}

beforeAll(async () => {
  const candidate = new pg.Pool({ connectionString: DATABASE_URL, max: 6 });
  try {
    const { rows } = await candidate.query<{ count: string }>(
      "select count(*) as count from information_schema.tables where table_name = 'ingestion_jobs'",
    );
    if (rows[0]?.count === '0') throw new Error('run `npm run db:migrate`');
    pool = candidate;
    available = true;
  } catch {
    await candidate.end().catch(() => undefined);
    available = false;
    return;
  }

  storage = createLocalStorage({
    root: storageRoot,
    secret: 'worker-test',
    publicBaseUrl: 'http://localhost:4000/v1',
  });

  await pool.query('delete from users where auth_provider_id = $1', ['worker-it']);
  const user = await pool.query<{ id: string }>(
    `insert into users (auth_provider_id, email)
     values ('worker-it', 'worker-it@mira.local') returning id`,
  );
  userId = user.rows[0]!.id;

  const closet = await pool.query<{ id: string }>(
    `insert into closets (user_id, name) values ($1, 'Worker') returning id`,
    [userId],
  );
  closetId = closet.rows[0]!.id;
});

afterAll(async () => {
  await pool?.query('delete from users where auth_provider_id = $1', ['worker-it']).catch(
    () => undefined,
  );
  await pool?.end();
  rmSync(storageRoot, { recursive: true, force: true });
});

/**
 * Every test starts with an empty queue.
 *
 * These tests share one table, and `claimNextJob` takes the OLDEST queued job
 * regardless of who queued it — so a job left behind by one test gets claimed
 * by the next, and the suite passes or fails depending on order. It did exactly
 * that: identical code failed eight tests on one run and none on the next.
 */
beforeEach(async () => {
  logged.length = 0;
  if (!available || !pool) return;
  // Cascades to garment_images; jobs are removed explicitly because they
  // reference the image rather than the garment.
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

describe('processOneJob', () => {
  dbIt('reports nothing to do on an empty queue', async () => {
    const worked = await processOneJob({ pool: pool!, ports: portsWith(), logger, onlyUserId: userId });
    expect(worked).toBe(false);
  });

  dbIt('fills in the facts the closet needs, and completes the job', async () => {
    const { imageId, jobId } = await seedCapture();

    expect(await processOneJob({ pool: pool!, ports: portsWith(), logger, onlyUserId: userId })).toBe(true);

    const image = await pool!.query(
      'select width, height, blurhash, image_hash from garment_images where id = $1',
      [imageId],
    );
    expect(image.rows[0]).toMatchObject({ width: 600, height: 800 });
    expect(image.rows[0].blurhash).toBeTruthy();
    // The real 64-bit perceptual hash, not the old sha256 prefix.
    expect(image.rows[0].image_hash).toMatch(/^[0-9a-f]{16}$/);

    const job = await pool!.query('select status, finished_at from ingestion_jobs where id = $1', [
      jobId,
    ]);
    expect(job.rows[0].status, whatHappened()).toBe('complete');
    expect(job.rows[0].finished_at).not.toBeNull();
  });

  dbIt('writes derivatives beside the original', async () => {
    const { key } = await seedCapture();
    await processOneJob({ pool: pool!, ports: portsWith(), logger, onlyUserId: userId });

    expect(await storage!.exists(derivedKey(key, 'thumb', 'webp'))).toBe(true);
    expect(await storage!.exists(derivedKey(key, 'medium', 'webp'))).toBe(true);
  });

  dbIt('records the derivative keys, not just the files', async () => {
    // The files existed before this and were unreachable: nothing recorded
    // where they were, so every closet tile loaded the full-size original.
    const { imageId, key } = await seedCapture();
    await processOneJob({ pool: pool!, ports: portsWith(), logger, onlyUserId: userId });

    const { rows } = await pool!.query<{ thumb_key: string; medium_key: string }>(
      'select thumb_key, medium_key from garment_images where id = $1',
      [imageId],
    );
    expect(rows[0]!.thumb_key).toBe(derivedKey(key, 'thumb', 'webp'));
    expect(rows[0]!.medium_key).toBe(derivedKey(key, 'medium', 'webp'));
  });

  dbIt('leaves the variant keys null when derivatives fail', async () => {
    // §8: a derivative failure must not cost the user their garment. The row
    // stays valid and the original serves.
    const { imageId, jobId } = await seedCapture();

    await processOneJob({
      pool: pool!,
      ports: portsWith({
        write: async () => {
          throw new Error('disk full');
        },
      }),
      logger,
      onlyUserId: userId,
    });

    const { rows } = await pool!.query(
      'select thumb_key, medium_key, blurhash from garment_images where id = $1',
      [imageId],
    );
    expect(rows[0].thumb_key).toBeNull();
    expect(rows[0].medium_key).toBeNull();
    // The rest of the work still landed.
    expect(rows[0].blurhash).toBeTruthy();

    const job = await pool!.query('select status from ingestion_jobs where id = $1', [jobId]);
    expect(job.rows[0].status).toBe('complete');
  });

  dbIt('gives each capture its own derivatives', async () => {
    // Two captures for the same user. Their derivatives must not collide —
    // they did, because every upload key sits in one directory per user.
    const first = await seedCapture();
    await processOneJob({ pool: pool!, ports: portsWith(), logger, onlyUserId: userId });
    const second = await seedCapture();
    await processOneJob({ pool: pool!, ports: portsWith(), logger, onlyUserId: userId });

    expect(derivedKey(first.key, 'thumb', 'webp')).not.toBe(
      derivedKey(second.key, 'thumb', 'webp'),
    );
    expect(await storage!.exists(derivedKey(first.key, 'thumb', 'webp'))).toBe(true);
    expect(await storage!.exists(derivedKey(second.key, 'thumb', 'webp'))).toBe(true);
  });

  dbIt('promotes an accepted cutout to canonical, demoting the original', async () => {
    const { garmentId, imageId } = await seedCapture();

    const cutoutKey = buildStorageKey('garments', userId, garmentId, 'cutout.png');
    await storage!.put(cutoutKey, await goodCutout());

    await processOneJob({
      pool: pool!,
      ports: portsWith({
        segmentation: { cutout: async () => ({ storageKey: cutoutKey, maskCoverage: 0.28 }) },
      }),
      logger,
    });

    const images = await pool!.query<{ id: string; kind: string; is_canonical: boolean }>(
      'select id, kind, is_canonical from garment_images where garment_id = $1 order by kind',
      [garmentId],
    );

    expect(images.rows, whatHappened()).toHaveLength(2);
    const cleaned = images.rows.find((r) => r.kind === 'cleaned');
    const original = images.rows.find((r) => r.kind === 'original');
    expect(cleaned?.is_canonical).toBe(true);
    expect(original?.is_canonical).toBe(false);
    expect(original?.id).toBe(imageId);
  });

  dbIt('keeps the original canonical when the cutout fails the quality gate', async () => {
    const { garmentId, imageId } = await seedCapture();

    // A speck: far below the coverage floor.
    const specks = Buffer.alloc(400 * 500 * 4, 0);
    for (let i = 0; i < 200; i += 1) specks[i * 4 + 3] = 255;
    const badKey = buildStorageKey('garments', userId, garmentId, 'bad-cutout.png');
    await storage!.put(
      badKey,
      await sharp(specks, { raw: { width: 400, height: 500, channels: 4 } })
        .png()
        .toBuffer(),
    );

    await processOneJob({
      pool: pool!,
      ports: portsWith({
        // The provider claims a healthy mask; the gate reads the alpha itself.
        segmentation: { cutout: async () => ({ storageKey: badKey, maskCoverage: 0.4 }) },
      }),
      logger,
    });

    const images = await pool!.query<{ id: string; is_canonical: boolean }>(
      'select id, is_canonical from garment_images where garment_id = $1',
      [garmentId],
    );
    expect(images.rows).toHaveLength(1);
    expect(images.rows[0]!.id).toBe(imageId);
    expect(images.rows[0]!.is_canonical).toBe(true);
  });

  dbIt('never leaves a garment with two canonical images', async () => {
    const { garmentId } = await seedCapture();
    const cutoutKey = buildStorageKey('garments', userId, garmentId, 'cutout2.png');
    await storage!.put(cutoutKey, await goodCutout());

    await processOneJob({
      pool: pool!,
      ports: portsWith({
        segmentation: { cutout: async () => ({ storageKey: cutoutKey, maskCoverage: 0.28 }) },
      }),
      logger,
    });

    const { rows } = await pool!.query<{ count: string }>(
      `select count(*) as count from garment_images
        where garment_id = $1 and is_canonical and deleted_at is null`,
      [garmentId],
    );
    expect(rows[0]!.count).toBe('1');
  });

  describe('failure handling', () => {
    dbIt('gives up immediately on an undecodable image', async () => {
      const { jobId } = await seedCapture({ bytes: Buffer.from('not an image at all') });

      await processOneJob({ pool: pool!, ports: portsWith(), logger, onlyUserId: userId });

      const job = await pool!.query('select status, attempts, error_code from ingestion_jobs where id = $1', [
        jobId,
      ]);
      // Retrying cannot make a text file decodable.
      expect(job.rows[0].status).toBe('failed');
      expect(job.rows[0].attempts).toBe(1);
      expect(job.rows[0].error_code).toMatch(/^unsupported_image_/);
    });

    dbIt('requeues a transient failure until attempts run out', async () => {
      const { jobId } = await seedCapture();

      const flaky = portsWith({
        read: async () => {
          throw new Error('storage unavailable');
        },
      });

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        await processOneJob({ pool: pool!, ports: flaky, logger, onlyUserId: userId });
        const job = await pool!.query<{ status: string; attempts: number }>(
          'select status, attempts from ingestion_jobs where id = $1',
          [jobId],
        );
        expect(job.rows[0]!.attempts).toBe(attempt);
        expect(job.rows[0]!.status).toBe(attempt >= MAX_ATTEMPTS ? 'failed' : 'queued');
      }
    });

    dbIt('fails a job whose image row has been deleted', async () => {
      const { imageId, jobId } = await seedCapture();
      await pool!.query('delete from garment_images where id = $1', [imageId]);

      // Nothing to process, but the job must not stay queued forever.
      await processOneJob({ pool: pool!, ports: portsWith(), logger, onlyUserId: userId });

      const job = await pool!.query('select status, error_code from ingestion_jobs where id = $1', [
        jobId,
      ]);
      expect(job.rows[0].status).toBe('failed');
      expect(job.rows[0].error_code).toBe('image_missing');
    });
  });

  dbIt('two workers never claim the same job', async () => {
    // Three jobs, four concurrent claims: every job processed exactly once, and
    // the fourth worker finds nothing rather than double-processing.
    const seeded = [await seedCapture(), await seedCapture(), await seedCapture()];

    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        processOneJob({ pool: pool!, ports: portsWith(), logger, onlyUserId: userId }),
      ),
    );

    expect(results.filter(Boolean)).toHaveLength(3);

    const { rows } = await pool!.query<{ status: string }>(
      `select status from ingestion_jobs where id = any($1::uuid[])`,
      [seeded.map((s) => s.jobId)],
    );
    expect(rows.every((r) => r.status === 'complete')).toBe(true);
  });
});
