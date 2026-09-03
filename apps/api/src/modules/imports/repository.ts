/**
 * Ingestion job records and garment imagery.
 *
 * Every statement goes through `scopedQuery`, which refuses a read that does
 * not filter on user_id and a write that does not supply it (SEC-5). RLS is the
 * second line, not the first.
 */
import type { Queryable } from '../../db/pool.js';
import { scopedQuery, type UserScope } from '../../db/scope.js';

export type IngestionJobRow = {
  id: string;
  job_type: string;
  entity_type: string | null;
  entity_id: string | null;
  status: string;
  attempts: number;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  finished_at: string | null;
};

export type CreateImageInput = {
  garmentId: string;
  kind: string;
  storageKey: string;
  width?: number | null;
  height?: number | null;
  blurhash?: string | null;
  imageHash?: string | null;
  isCanonical?: boolean;
  position?: number;
};

export class ImportsRepository {
  constructor(private readonly db: Queryable) {}

  async createIngestionJob(
    scope: UserScope,
    input: { jobType: string; entityType: string; entityId: string },
  ): Promise<IngestionJobRow> {
    const { rows } = await scopedQuery<IngestionJobRow>(
      this.db,
      scope,
      `insert into ingestion_jobs (user_id, job_type, entity_type, entity_id)
       values ($1, $2, $3, $4)
       returning id, job_type, entity_type, entity_id, status, attempts,
                 error_code, error_message,
                 created_at::text as created_at, finished_at::text as finished_at`,
      [scope.userId, input.jobType, input.entityType, input.entityId],
    );

    const row = rows[0];
    if (!row) throw new Error('ingestion job insert returned no row');
    return row;
  }

  async findIngestionJob(scope: UserScope, id: string): Promise<IngestionJobRow | null> {
    const { rows } = await scopedQuery<IngestionJobRow>(
      this.db,
      scope,
      `select id, job_type, entity_type, entity_id, status, attempts,
              error_code, error_message,
              created_at::text as created_at, finished_at::text as finished_at
         from ingestion_jobs
        where user_id = $1 and id = $2`,
      [scope.userId, id],
    );
    return rows[0] ?? null;
  }

  /**
   * Add an image to a garment.
   *
   * `is_canonical` is guarded by a unique index, so promoting a new canonical
   * means demoting the old one in the same transaction — done here rather than
   * left to callers, because a half-applied swap leaves a garment with either
   * two canonical images (a constraint violation) or none (a blank tile).
   */
  async createImage(scope: UserScope, input: CreateImageInput): Promise<{ id: string }> {
    if (input.isCanonical) await this.demoteCanonical(scope, input.garmentId);

    const { rows } = await scopedQuery<{ id: string }>(
      this.db,
      scope,
      `insert into garment_images
         (garment_id, user_id, kind, storage_key, width, height,
          blurhash, image_hash, is_canonical, position)
       values ($2, $1, $3, $4, $5, $6, $7, $8, $9, $10)
       returning id`,
      [
        scope.userId,
        input.garmentId,
        input.kind,
        input.storageKey,
        input.width ?? null,
        input.height ?? null,
        input.blurhash ?? null,
        input.imageHash ?? null,
        input.isCanonical ?? false,
        input.position ?? 0,
      ],
    );

    const row = rows[0];
    if (!row) throw new Error('garment image insert returned no row');
    return row;
  }

  private async demoteCanonical(scope: UserScope, garmentId: string): Promise<void> {
    await scopedQuery(
      this.db,
      scope,
      `update garment_images set is_canonical = false
        where user_id = $1 and garment_id = $2 and is_canonical`,
      [scope.userId, garmentId],
    );
  }

  /**
   * Has this exact photograph already been imported?
   *
   * Cheap exact-match guard on the perceptual hash. This is NOT duplicate
   * detection — that weighs several signals and lives in its own module. This
   * only catches the same bytes arriving twice, which is common enough on a
   * flaky connection to be worth refusing before it becomes a second garment.
   */
  async findByImageHash(
    scope: UserScope,
    imageHash: string,
  ): Promise<{ garment_id: string } | null> {
    const { rows } = await scopedQuery<{ garment_id: string }>(
      this.db,
      scope,
      `select garment_id from garment_images
        where user_id = $1 and image_hash = $2 and deleted_at is null
        limit 1`,
      [scope.userId, imageHash],
    );
    return rows[0] ?? null;
  }
}
