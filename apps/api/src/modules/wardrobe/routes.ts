/**
 * Wardrobe insight routes (`docs/05-api/api-contract.md` — Wardrobe insights).
 *
 * > Insights return hydrated garments so the client can render imagery without
 * > a second round trip.
 *
 * That is not a performance note: the screen is "fashion content, not a
 * dashboard", and content that arrives without its pictures is a dashboard for
 * however long the images take.
 */
import type { FastifyInstance } from 'fastify';
import { requireAuth, requireScope } from '../../http/auth.js';
import type { WardrobeService } from './service.js';
import type { InsightKind } from './rules.js';

const KINDS: InsightKind[] = ['forgotten', 'never_worn', 'tags_attached', 'most_loved'];

export async function registerWardrobeRoutes(
  app: FastifyInstance,
  deps: { service: WardrobeService },
): Promise<void> {
  const { service } = deps;

  app.get('/wardrobe/insights', { onRequest: requireAuth }, async (request) => {
    const query = request.query as Record<string, string | string[] | undefined>;
    const raw = query['kinds'] ?? query['kinds[]'];
    const requested = (Array.isArray(raw) ? raw : raw ? raw.split(',') : []).filter(
      (kind): kind is InsightKind => (KINDS as string[]).includes(kind),
    );

    return {
      data: await service.insights(requireScope(request), requested.length > 0 ? requested : KINDS),
    };
  });

  /**
   * "You might already own this" (`screen-specs.md` §26, task 9.2).
   *
   * Separate from `/wardrobe/insights` because it is shaped differently: every
   * other insight is a rail of garments, and this one is pairs. Folding pairs
   * into the same list would make every client branch on `kind` before it could
   * read the payload at all.
   */
  app.get('/wardrobe/similar-owned', { onRequest: requireAuth }, async (request) => {
    return { data: await service.similarOwned(requireScope(request)) };
  });

  app.get('/wardrobe/stats', { onRequest: requireAuth }, async (request) => {
    return service.stats(requireScope(request));
  });

  /** The wear calendar (`screen-specs.md` §27). */
  app.get('/wardrobe/wear-history', { onRequest: requireAuth }, async (request) => {
    const query = request.query as Record<string, string | undefined>;

    // Defaults to the last three months, which is what the calendar shows.
    const to = query['to'] ?? new Date().toISOString().slice(0, 10);
    const from =
      query['from'] ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    return { data: await service.wearHistory(requireScope(request), { from, to }) };
  });
}
