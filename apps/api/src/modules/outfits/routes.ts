/**
 * Outfit and wear-tracking routes (`docs/05-api/api-contract.md`).
 *
 * `POST /outfits/generate` — the stylist — is Phase 7 and deliberately absent
 * rather than stubbed: an endpoint that exists and returns nothing useful is
 * harder to reason about than one that is not there yet.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireScope } from '../../http/auth.js';
import { ApiError, ErrorCode, validationFailed } from '../../http/errors.js';
import type { OutfitService } from './service.js';
import type { OutfitTab } from './repository.js';

const TABS = ['saved', 'worn', 'mira', 'mine'] as const;

const CreateOutfitSchema = z.object({
  name: z.string().max(120).nullish(),
  occasion: z.string().max(40).nullish(),
  season: z.array(z.string().max(20)).max(4).optional(),
  items: z
    .array(z.object({ garment_id: z.string().uuid(), slot: z.string().max(20) }))
    .min(1)
    .max(20),
});

const WearEventSchema = z
  .object({
    garment_id: z.string().uuid().nullish(),
    outfit_id: z.string().uuid().nullish(),
    // Defaults to today: the overwhelmingly common case is "I wore this".
    worn_on: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'worn_on must be YYYY-MM-DD')
      .optional(),
    note: z.string().max(500).nullish(),
  })
  .refine((body) => Boolean(body.garment_id ?? body.outfit_id), {
    message: 'a wear event needs a garment or an outfit',
    path: ['garment_id'],
  });

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw validationFailed(
      result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        issue: issue.message,
      })),
    );
  }
  return result.data;
}

export async function registerOutfitRoutes(
  app: FastifyInstance,
  deps: { service: OutfitService },
): Promise<void> {
  const { service } = deps;

  app.get('/outfits', { onRequest: requireAuth }, async (request) => {
    const query = request.query as Record<string, string | undefined>;
    const requested = query['tab'] ?? 'mine';
    const tab = (TABS as readonly string[]).includes(requested) ? (requested as OutfitTab) : 'mine';

    const limit = Math.min(Number(query['limit'] ?? 50) || 50, 100);
    return { data: await service.list(requireScope(request), tab, limit) };
  });

  app.get('/outfits/:id', { onRequest: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return service.get(requireScope(request), id);
  });

  app.post('/outfits', { onRequest: requireAuth }, async (request, reply) => {
    if (!request.headers['idempotency-key']) {
      throw new ApiError(400, ErrorCode.missingIdempotencyKey, {
        message: 'This request needs an Idempotency-Key header.',
      });
    }

    const body = parse(CreateOutfitSchema, request.body);
    const outfit = await service.create(requireScope(request), {
      name: body.name ?? null,
      occasion: body.occasion ?? null,
      season: body.season ?? [],
      items: body.items,
    });

    return reply.status(201).send(outfit);
  });

  app.post('/outfits/:id/favorite', { onRequest: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const body = z.object({ favorite: z.boolean() }).safeParse(request.body);
    const favorite = body.success ? body.data.favorite : true;

    return service.setFavorite(requireScope(request), id, favorite);
  });

  app.delete('/outfits/:id', { onRequest: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await service.remove(requireScope(request), id);
    return reply.status(204).send();
  });

  // --- wear tracking ------------------------------------------------------

  app.post('/wear-events', { onRequest: requireAuth }, async (request, reply) => {
    const body = parse(WearEventSchema, request.body);
    const today = new Date().toISOString().slice(0, 10);

    const result = await service.recordWear(requireScope(request), {
      garmentId: body.garment_id ?? null,
      outfitId: body.outfit_id ?? null,
      wornOn: body.worn_on ?? today,
      note: body.note ?? null,
    });

    // `created` is plural on purpose: wearing a look wears everything in it.
    return reply.status(201).send(result);
  });

  app.get('/wear-events', { onRequest: requireAuth }, async (request) => {
    const query = request.query as Record<string, string | undefined>;
    const limit = Math.min(Number(query['limit'] ?? 100) || 100, 365);

    return {
      data: await service.wearEvents(requireScope(request), {
        from: query['from'] ?? null,
        to: query['to'] ?? null,
        limit,
      }),
    };
  });

  app.delete('/wear-events/:id', { onRequest: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await service.removeWearEvent(requireScope(request), id);
    return reply.status(204).send();
  });
}
