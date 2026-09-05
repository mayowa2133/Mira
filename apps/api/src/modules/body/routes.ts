/**
 * Body profile (tasks 10.1, 10.7).
 *
 * The strictest surface in Mira. Three rules shape every handler here:
 *
 * - **Hard deletion, immediately.** `data-retention.md`: "A user deleting a
 *   photograph of their own body must not be told it is in a recycle bin for a
 *   month." The object goes, then the row, and neither is recoverable.
 * - **Signed URLs are short-lived.** The `body` bucket is 120 seconds against
 *   garments' 300, because a leaked body-image URL is a different order of harm.
 * - **Biometric re-authentication gates this surface** (auth-contract rule 6).
 *   That gate is the client's — the server cannot verify a fingerprint — which
 *   is exactly why the API does not treat it as security, only the scoping does.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildStorageKey, bucketOf, userOf, type StorageDriver } from '@mira/storage';
import type { Queryable } from '../../db/pool.js';
import { getPool } from '../../db/pool.js';
import { scopedQuery, type UserScope } from '../../db/scope.js';
import { requireAuth, requireScope } from '../../http/auth.js';
import { ApiError, ErrorCode, notFound, validationFailed } from '../../http/errors.js';

type ProfileRow = {
  id: string;
  height_cm: number | null;
  usual_sizes: Record<string, unknown>;
  fit_preferences: Record<string, unknown>;
  created_at: Date;
};

type ImageRow = { id: string; kind: string; storage_key: string; created_at: Date };

export class BodyRepository {
  constructor(private readonly db: Queryable) {}

  async active(scope: UserScope): Promise<ProfileRow | null> {
    const { rows } = await scopedQuery<ProfileRow>(
      this.db,
      scope,
      `select id, height_cm, usual_sizes, fit_preferences, created_at
         from body_profiles
        where user_id = $1 and is_active and deleted_at is null`,
      [scope.userId],
    );
    return rows[0] ?? null;
  }

  async upsert(
    scope: UserScope,
    input: { heightCm: number | null; usualSizes: unknown; fitPreferences: unknown },
  ): Promise<ProfileRow> {
    const existing = await this.active(scope);
    if (existing) {
      const { rows } = await scopedQuery<ProfileRow>(
        this.db,
        scope,
        `update body_profiles
            set height_cm = $3, usual_sizes = $4, fit_preferences = $5, updated_at = now()
          where user_id = $1 and id = $2
          returning id, height_cm, usual_sizes, fit_preferences, created_at`,
        [
          scope.userId,
          existing.id,
          input.heightCm,
          JSON.stringify(input.usualSizes ?? {}),
          JSON.stringify(input.fitPreferences ?? {}),
        ],
      );
      const row = rows[0];
      if (!row) throw new Error('body profile update returned no row');
      return row;
    }

    const { rows } = await scopedQuery<ProfileRow>(
      this.db,
      scope,
      `insert into body_profiles (user_id, height_cm, usual_sizes, fit_preferences)
       values ($1, $2, $3, $4)
       returning id, height_cm, usual_sizes, fit_preferences, created_at`,
      [
        scope.userId,
        input.heightCm,
        JSON.stringify(input.usualSizes ?? {}),
        JSON.stringify(input.fitPreferences ?? {}),
      ],
    );
    const row = rows[0];
    if (!row) throw new Error('body profile insert returned no row');
    return row;
  }

  async images(scope: UserScope, profileId: string): Promise<ImageRow[]> {
    const { rows } = await scopedQuery<ImageRow>(
      this.db,
      scope,
      `select id, kind, storage_key, created_at
         from body_profile_images
        where user_id = $1 and body_profile_id = $2
        order by created_at`,
      [scope.userId, profileId],
    );
    return rows;
  }

  async addImage(
    scope: UserScope,
    input: { profileId: string; kind: string; storageKey: string },
  ): Promise<ImageRow> {
    const { rows } = await scopedQuery<ImageRow>(
      this.db,
      scope,
      `insert into body_profile_images (body_profile_id, user_id, kind, storage_key)
       values ($1, $2, $3, $4)
       returning id, kind, storage_key, created_at`,
      [input.profileId, scope.userId, input.kind, input.storageKey],
    );
    const row = rows[0];
    if (!row) throw new Error('body image insert returned no row');
    return row;
  }

  /** Hard. There is no `deleted_at` on this table, deliberately. */
  async deleteImage(scope: UserScope, id: string): Promise<ImageRow | null> {
    const { rows } = await scopedQuery<ImageRow>(
      this.db,
      scope,
      `delete from body_profile_images where user_id = $1 and id = $2
        returning id, kind, storage_key, created_at`,
      [scope.userId, id],
    );
    return rows[0] ?? null;
  }

  async deleteProfile(scope: UserScope): Promise<ImageRow[]> {
    // Images first and returned, so the caller can delete the objects. The
    // cascade would remove the rows and leave the files, which is the failure
    // mode that matters most on this table.
    const { rows } = await scopedQuery<ImageRow>(
      this.db,
      scope,
      `delete from body_profile_images where user_id = $1
        returning id, kind, storage_key, created_at`,
      [scope.userId],
    );
    await scopedQuery(this.db, scope, `delete from body_profiles where user_id = $1`, [
      scope.userId,
    ]);
    return rows;
  }
}

export async function registerBodyRoutes(
  app: FastifyInstance,
  deps: { storage: StorageDriver },
): Promise<void> {
  const { storage } = deps;
  const repo = () => new BodyRepository(getPool());

  const serialize = async (scope: UserScope, profile: ProfileRow, images: ImageRow[]) => ({
    id: profile.id,
    height_cm: profile.height_cm,
    usual_sizes: profile.usual_sizes,
    fit_preferences: profile.fit_preferences,
    images: await Promise.all(
      images.map(async (image) => {
        const signed = await storage.signedReadUrl(image.storage_key, scope.userId);
        return {
          id: image.id,
          kind: image.kind,
          url: signed.url,
          // 120 seconds, not 300. Short enough that a URL shared by accident
          // is usually already dead.
          url_expires_at: signed.expiresAt,
        };
      }),
    ),
    created_at: profile.created_at.toISOString(),
  });

  app.get('/body-profile', { onRequest: requireAuth }, async (request) => {
    const scope = requireScope(request);
    const profile = await repo().active(scope);
    // Absent is a real answer here, not an error: most users have none.
    if (!profile) return { data: null };
    return { data: await serialize(scope, profile, await repo().images(scope, profile.id)) };
  });

  app.put('/body-profile', { onRequest: requireAuth }, async (request) => {
    const parsed = z
      .object({
        height_cm: z.number().int().min(50).max(260).nullable().optional(),
        usual_sizes: z.record(z.string(), z.unknown()).optional(),
        fit_preferences: z.record(z.string(), z.unknown()).optional(),
      })
      .safeParse(request.body ?? {});
    if (!parsed.success) {
      throw validationFailed(
        parsed.error.issues.map((i) => ({ field: i.path.join('.'), issue: i.message })),
      );
    }

    const scope = requireScope(request);
    const profile = await repo().upsert(scope, {
      heightCm: parsed.data.height_cm ?? null,
      usualSizes: parsed.data.usual_sizes ?? {},
      fitPreferences: parsed.data.fit_preferences ?? {},
    });
    return { data: await serialize(scope, profile, await repo().images(scope, profile.id)) };
  });

  app.post('/body-profile/images', { onRequest: requireAuth }, async (request) => {
    const parsed = z
      .object({
        upload_key: z.string().min(1),
        kind: z.enum(['front', 'side', 'back', 'reference']),
      })
      .safeParse(request.body);
    if (!parsed.success) {
      throw validationFailed(
        parsed.error.issues.map((i) => ({ field: i.path.join('.'), issue: i.message })),
      );
    }

    const scope = requireScope(request);
    const key = parsed.data.upload_key;

    // The key's own prefix says who it belongs to and which bucket it is in.
    // Trusting the request instead is the whole IDOR surface of an upload.
    if (bucketOf(key) !== 'body' || userOf(key) !== scope.userId) {
      throw new ApiError(422, ErrorCode.uploadKeyInvalid);
    }
    if (!(await storage.exists(key))) {
      throw new ApiError(422, ErrorCode.uploadKeyInvalid);
    }

    const profile =
      (await repo().active(scope)) ??
      (await repo().upsert(scope, {
        heightCm: null,
        usualSizes: {},
        fitPreferences: {},
      }));
    const image = await repo().addImage(scope, {
      profileId: profile.id,
      kind: parsed.data.kind,
      storageKey: key,
    });

    return { data: { id: image.id, kind: image.kind } };
  });

  /**
   * Delete one body image. Hard, immediate, object first.
   *
   * Object before row: the reverse loses the key and leaves the file
   * unreachable and undeleted, which is the worst outcome on this table.
   */
  app.delete('/body-profile/images/:id', { onRequest: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const scope = requireScope(request);

    const row = await repo().deleteImage(scope, id);
    if (!row) throw notFound(ErrorCode.bodyProfileNotFound);
    await storage.delete(row.storage_key);

    return reply.status(204).send();
  });

  /** Delete the whole profile, its images, and their objects (10.7). */
  app.delete('/body-profile', { onRequest: requireAuth }, async (request, reply) => {
    const scope = requireScope(request);
    const removed = await repo().deleteProfile(scope);
    for (const image of removed) await storage.delete(image.storage_key);

    // A prefix delete as well, because an object whose row was lost earlier —
    // an interrupted upload — would otherwise outlive the profile.
    await storage.deletePrefix('body', scope.userId);

    return reply.status(204).send();
  });
}

export { buildStorageKey };
