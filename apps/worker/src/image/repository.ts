/**
 * Persistence for `image.process`.
 *
 * The worker reaches the database directly rather than calling the API: it is
 * writing derived facts about rows it already owns by job, and routing that
 * through HTTP would mean inventing an internal endpoint that exists only to be
 * trusted — a bigger authorization surface than a scoped SQL statement.
 *
 * Every statement filters on `user_id` for the same reason the API's does: RLS
 * is defence in depth, not the first line (SEC-5).
 */
import type { Pool, PoolClient } from 'pg';

export type ClaimedJob = {
  id: string;
  userId: string;
  garmentImageId: string;
  uploadKey: string;
  attempts: number;
};

/**
 * Take the next queued `image.process` job, if there is one.
 *
 * `FOR UPDATE SKIP LOCKED` is what makes more than one worker safe: each
 * transaction claims a different row instead of blocking on the same one, and a
 * worker that dies mid-job releases its lock without leaving the row claimed
 * forever.
 */
export type ClaimOptions = {
  /**
   * Restrict claiming to one user.
   *
   * Production passes nothing: a worker takes whatever is oldest. This exists
   * because the claim is otherwise GLOBAL, and integration tests share a
   * database with real data — without it a test run claims and fails a real
   * user's jobs, which is exactly what happened the first time this ran.
   */
  userId?: string;
};

export async function claimNextJob(
  pool: Pool,
  options: ClaimOptions = {},
): Promise<ClaimedJob | null> {
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
          set status = 'running',
              attempts = attempts + 1,
              started_at = now()
        where id = (
          select id from ingestion_jobs
           where status = 'queued'
             and job_type = 'image.process'
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

    // The upload key lives on the image row, not the job: the job records WHAT
    // to do, the image records what it is.
    const image = await client.query<{ storage_key: string }>(
      `select storage_key from garment_images
        where user_id = $1 and id = $2 and deleted_at is null`,
      [job.user_id, job.entity_id],
    );

    const storageKey = image.rows[0]?.storage_key;
    if (!storageKey) {
      // The image was deleted between import and processing. Nothing to do, and
      // retrying will not bring it back.
      await client.query(
        `update ingestion_jobs
            set status = 'failed', error_code = 'image_missing',
                error_message = 'the image row no longer exists',
                finished_at = now()
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
      garmentImageId: job.entity_id,
      uploadKey: storageKey,
      attempts: job.attempts,
    };
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export type ProcessedImage = {
  width: number;
  height: number;
  blurhash: string;
  imageHash: string;
  /** Null when derivative generation failed; the original serves meanwhile. */
  thumbKey: string | null;
  mediumKey: string | null;
  /** Set only when a cutout passed the quality gate. */
  cutoutStorageKey: string | null;
};

/**
 * Record what processing produced.
 *
 * Done in one transaction because the canonical swap is two statements — demote
 * the original, promote the cutout — and a unique index enforces that exactly
 * one image per garment is canonical. Half of that swap is a constraint
 * violation or a garment with no image at all.
 */
export async function recordResult(
  pool: Pool,
  job: ClaimedJob,
  result: ProcessedImage,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('begin');

    await client.query(
      `update garment_images
          set width = $3, height = $4, blurhash = $5, image_hash = $6,
              thumb_key = $7, medium_key = $8
        where user_id = $1 and id = $2`,
      [
        job.userId,
        job.garmentImageId,
        result.width,
        result.height,
        result.blurhash,
        result.imageHash,
        result.thumbKey,
        result.mediumKey,
      ],
    );

    if (result.cutoutStorageKey) {
      const garment = await client.query<{ garment_id: string; position: number }>(
        `select garment_id, position from garment_images
          where user_id = $1 and id = $2`,
        [job.userId, job.garmentImageId],
      );
      const garmentId = garment.rows[0]?.garment_id;

      if (garmentId) {
        await client.query(
          `update garment_images set is_canonical = false
            where user_id = $1 and garment_id = $2 and is_canonical`,
          [job.userId, garmentId],
        );

        // `cleaned` is the kind; `is_canonical` is the flag that decides what
        // the closet shows (taxonomy §13).
        await client.query(
          `insert into garment_images
             (garment_id, user_id, kind, storage_key, thumb_key, medium_key,
              width, height, blurhash, image_hash, is_canonical, position)
           values ($2, $1, 'cleaned', $3, $4, $5, $6, $7, $8, $9, true, 0)`,
          [
            job.userId,
            garmentId,
            result.cutoutStorageKey,
            // The derivatives describe the same pixels, so the cleaned row
            // carries them too rather than falling back to the full original.
            result.thumbKey,
            result.mediumKey,
            result.width,
            result.height,
            result.blurhash,
            result.imageHash,
          ],
        );
      }
    }

    await client.query(
      `update ingestion_jobs
          set status = 'complete', finished_at = now(), error_code = null, error_message = null
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

/** Give up, or hand the job back for another attempt. */
export async function recordFailure(
  pool: Pool,
  job: ClaimedJob,
  options: { code: string; message: string; retryable: boolean; maxAttempts: number },
): Promise<void> {
  const exhausted = !options.retryable || job.attempts >= options.maxAttempts;

  await pool.query(
    `update ingestion_jobs
        set status = $2,
            error_code = $3,
            error_message = $4,
            finished_at = case when $2 = 'failed' then now() else null end
      where id = $1`,
    [
      job.id,
      exhausted ? 'failed' : 'queued',
      options.code,
      options.message.slice(0, 500),
    ],
  );
}

export type { Pool, PoolClient };
