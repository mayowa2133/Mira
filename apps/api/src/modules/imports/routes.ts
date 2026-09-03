/**
 * Import routes (`docs/05-api/api-contract.md` — Imports).
 *
 * Photo import takes an `upload_key` for an object the client has already PUT
 * to private storage, not the bytes themselves (D-017). The client uploads
 * first and imports second, which keeps megabytes off the API request path and
 * lets a queued offline capture hold a key rather than a body.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireScope } from '../../http/auth.js';
import { ApiError, ErrorCode, notFound, validationFailed } from '../../http/errors.js';
import type { IdentityRepository } from '../identity/repository.js';
import type { ImportsRepository } from './repository.js';
import type { ImportsService } from './service.js';

const PhotoImportSchema = z.object({
  upload_key: z.string().min(1).max(500),
  source: z.enum(['camera', 'photo_library']).default('camera'),
});

export async function registerImportRoutes(
  app: FastifyInstance,
  deps: {
    service: ImportsService;
    repository: ImportsRepository;
    identity: IdentityRepository;
  },
): Promise<void> {
  const { service, repository, identity } = deps;

  app.post('/imports/photo', { onRequest: requireAuth }, async (request, reply) => {
    const idempotencyKey = request.headers['idempotency-key'];
    if (typeof idempotencyKey !== 'string' || !idempotencyKey) {
      throw new ApiError(400, ErrorCode.missingIdempotencyKey, {
        message: 'This request needs an Idempotency-Key header.',
      });
    }

    const parsed = PhotoImportSchema.safeParse(request.body);
    if (!parsed.success) {
      throw validationFailed(
        parsed.error.issues.map((i) => ({ field: i.path.join('.'), issue: i.message })),
      );
    }

    const scope = requireScope(request);
    const closet =
      (await identity.findDefaultCloset(scope)) ?? (await identity.createDefaultCloset(scope));

    const result = await service.importPhoto(scope, {
      uploadKey: parsed.data.upload_key,
      closetId: closet.id,
      sourceType: parsed.data.source,
      idempotencyKey,
    });

    // 202: the garment exists now, its imagery does not yet.
    return reply.status(202).send({
      garment_id: result.garmentId,
      garment_image_id: result.garmentImageId,
      job_id: result.jobId,
      duplicate_of_garment_id: result.duplicateOfGarmentId,
    });
  });

  /** Job status, so a failed import is visible and retryable (REL-3). */
  app.get('/imports/:id', { onRequest: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const scope = requireScope(request);

    const job = await repository.findIngestionJob(scope, id);
    // 404 rather than 403 for another user's job: an authorization error would
    // confirm the job exists.
    if (!job) throw notFound(ErrorCode.importNotFound);

    return {
      id: job.id,
      job_type: job.job_type,
      entity_type: job.entity_type,
      entity_id: job.entity_id,
      status: job.status,
      attempts: job.attempts,
      error_code: job.error_code,
      error_message: job.error_message,
      created_at: job.created_at,
      finished_at: job.finished_at,
    };
  });
}
