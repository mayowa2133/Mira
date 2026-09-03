/**
 * Media routes.
 *
 * Serves private objects through short-lived signed URLs. There is no public
 * bucket, and no object is readable without a valid signature bound to the
 * requesting user (SEC-4, `docs/04-data/storage-strategy.md` §5).
 *
 * Note these routes are deliberately NOT behind `requireAuth`: the signature IS
 * the authorization, which is what lets an <Image> tag load the URL without
 * carrying a bearer token. The signature is user-bound and expiring, so it
 * grants exactly one object to exactly one user for a couple of minutes.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireScope } from '../../http/auth.js';
import { ApiError, ErrorCode, validationFailed } from '../../http/errors.js';
import { BUCKETS, userOf, type BucketName, type StorageDriver } from '../../lib/storage.js';

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

function contentTypeFor(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase() ?? '';
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

export async function registerMediaRoutes(
  app: FastifyInstance,
  deps: { storage: StorageDriver },
): Promise<void> {
  const { storage } = deps;

  /** Issue a scoped upload target (`docs/05-api/api-contract.md` — Media). */
  app.post('/media/upload-url', { onRequest: requireAuth }, async (request) => {
    const scope = requireScope(request);
    const body = z
      .object({
        purpose: z.enum(['garment', 'body', 'receipt']),
        content_type: z.string(),
        filename: z.string().max(200).optional(),
      })
      .safeParse(request.body);

    if (!body.success) {
      throw validationFailed(
        body.error.issues.map((i) => ({ field: i.path.join('.'), issue: i.message })),
      );
    }

    const bucket: BucketName =
      body.data.purpose === 'garment'
        ? 'garments'
        : body.data.purpose === 'body'
          ? 'body'
          : 'imports';

    const result = await storage.signedUploadUrl(
      bucket,
      scope.userId,
      body.data.filename ?? 'upload',
    );

    return {
      upload_url: result.uploadUrl,
      upload_key: result.storageKey,
      expires_at: result.expiresAt,
    };
  });

  /**
   * Read a private object.
   *
   * Authorization is the signature: it binds the key to a user and expires
   * after the bucket's TTL. A key belonging to another user cannot be signed
   * for this one, so a leaked URL is not transferable.
   */
  app.get('/media/*', async (request, reply) => {
    const storageKey = (request.params as Record<string, string>)['*'] ?? '';
    const query = request.query as Record<string, string | undefined>;

    const expires = Number(query['expires']);
    const signature = query['signature'];

    if (!Number.isFinite(expires) || !signature) {
      throw new ApiError(404, ErrorCode.internal, { message: 'Not found.' });
    }

    const owner = userOf(storageKey);
    if (!owner || !storage.verify(storageKey, owner, expires, signature)) {
      // 404, not 403: a bad signature must not confirm the object exists.
      throw new ApiError(404, ErrorCode.internal, { message: 'Not found.' });
    }

    const body = await storage.get(storageKey);
    if (!body) throw new ApiError(404, ErrorCode.internal, { message: 'Not found.' });

    return (
      reply
        .header('content-type', contentTypeFor(storageKey))
        // Private, and only for as long as the signature lasts.
        .header('cache-control', `private, max-age=${BUCKETS.garments.ttlSeconds}, no-store`)
        .send(body)
    );
  });

  /** Accept a direct upload against a signed target. */
  app.put('/media/upload/*', async (request, reply) => {
    const storageKey = (request.params as Record<string, string>)['*'] ?? '';
    const query = request.query as Record<string, string | undefined>;

    const expires = Number(query['expires']);
    const signature = query['signature'];
    const owner = userOf(storageKey);

    if (
      !Number.isFinite(expires) ||
      !signature ||
      !owner ||
      !storage.verify(storageKey, owner, expires, signature)
    ) {
      throw new ApiError(404, ErrorCode.uploadKeyInvalid, { message: 'Not found.' });
    }

    const body = request.body;
    if (!Buffer.isBuffer(body)) {
      throw new ApiError(415, ErrorCode.unsupportedImageFormat, {
        message: 'That file type is not supported.',
      });
    }

    await storage.put(storageKey, body);
    return reply.status(204).send();
  });
}
