/**
 * Purchase candidate routes (`docs/05-api/api-contract.md` — Purchase candidates).
 *
 * > Transitioning to `confirmed_owned` runs duplicate detection and creates a
 * > garment, returning `linked_garment_id`. **No other transition creates a
 * > garment** (OWN-1).
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireScope } from '../../http/auth.js';
import { validationFailed } from '../../http/errors.js';
import type { PurchaseService } from './service.js';

const MAX_LIMIT = 100;

const asArray = (value: unknown): string[] | undefined => {
  if (value === undefined || value === null) return undefined;
  return Array.isArray(value) ? value.map(String) : [String(value)];
};

export async function registerPurchaseRoutes(
  app: FastifyInstance,
  deps: { service: PurchaseService },
): Promise<void> {
  const { service } = deps;

  app.get('/purchase-candidates', { onRequest: requireAuth }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const rawLimit = query['limit'] === undefined ? 40 : Number(query['limit']);
    if (!Number.isFinite(rawLimit) || rawLimit < 1 || rawLimit > MAX_LIMIT) {
      throw validationFailed([{ field: 'limit', issue: `must be between 1 and ${MAX_LIMIT}` }]);
    }

    return service.list(requireScope(request), {
      ...(asArray(query['status']) ? { status: asArray(query['status']) as string[] } : {}),
      ...(asArray(query['retailer']) ? { retailer: asArray(query['retailer']) as string[] } : {}),
      limit: rawLimit,
    });
  });

  app.get('/purchase-candidates/summary', { onRequest: requireAuth }, async (request) => {
    return service.summary(requireScope(request));
  });

  app.get('/purchase-candidates/:id', { onRequest: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return service.get(requireScope(request), id);
  });

  app.patch('/purchase-candidates/:id', { onRequest: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const parsed = z.object({ status: z.string() }).safeParse(request.body);
    if (!parsed.success) {
      throw validationFailed([{ field: 'status', issue: 'required' }]);
    }
    return service.setStatus(requireScope(request), id, parsed.data.status);
  });

  /**
   * Bulk status change — "everything from this retailer" (A-03).
   *
   * Applied one at a time rather than in a single statement, because each
   * transition may create a garment and run duplicate detection. A failure part
   * way leaves the ones already decided decided, which is the right outcome:
   * redoing twenty confirmations because the twenty-first was a duplicate would
   * be worse than a partial result the user can see.
   */
  app.post('/purchase-candidates/bulk', { onRequest: requireAuth }, async (request) => {
    const parsed = z
      .object({ ids: z.array(z.string().uuid()).min(1).max(100), status: z.string() })
      .safeParse(request.body);
    if (!parsed.success) {
      throw validationFailed(
        parsed.error.issues.map((i) => ({ field: i.path.join('.'), issue: i.message })),
      );
    }

    const scope = requireScope(request);
    const updated: unknown[] = [];
    const failed: { id: string; reason: string }[] = [];

    for (const id of parsed.data.ids) {
      try {
        updated.push(await service.setStatus(scope, id, parsed.data.status));
      } catch (error) {
        failed.push({
          id,
          reason: error instanceof Error ? error.message : 'unknown',
        });
      }
    }

    // Both halves reported. A bulk action that says only "done" while silently
    // dropping four is how someone discovers the gap a week later.
    return { updated, failed };
  });
}
