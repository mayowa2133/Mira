/**
 * Closet routes (`docs/05-api/api-contract.md` — Closet and garments).
 *
 * Routes validate, authorize and delegate. No business logic here
 * (`docs/03-architecture/backend-architecture.md` §1).
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireScope } from '../../http/auth.js';
import { ApiError, ErrorCode, validationFailed } from '../../http/errors.js';
import type { ClosetService } from './service.js';
import { SORT_KEYS, type GarmentFilters, type SortKey } from './filters.js';
import type { IdentityRepository } from '../identity/repository.js';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 40;

/** Query strings deliver repeated keys as `a&a`; normalize to an array. */
const asArray = (value: unknown): string[] | undefined => {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value.map(String);
  return [String(value)];
};

const asBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null) return undefined;
  const s = String(value).toLowerCase();
  if (s === 'true' || s === '1') return true;
  if (s === 'false' || s === '0') return false;
  return undefined;
};

const asNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

export function parseListQuery(query: Record<string, unknown>): {
  filters: GarmentFilters;
  sort: SortKey;
  limit: number;
  cursor: string | null;
} {
  const rawLimit = asNumber(query['limit']) ?? DEFAULT_LIMIT;
  if (rawLimit < 1 || rawLimit > MAX_LIMIT) {
    throw validationFailed([{ field: 'limit', issue: `must be between 1 and ${MAX_LIMIT}` }]);
  }

  const rawSort = query['sort'] === undefined ? 'recent' : String(query['sort']);
  if (!SORT_KEYS.includes(rawSort as SortKey)) {
    throw validationFailed([{ field: 'sort', issue: `must be one of: ${SORT_KEYS.join(', ')}` }]);
  }

  const filters: GarmentFilters = {};
  const setIf = <K extends keyof GarmentFilters>(key: K, value: GarmentFilters[K]) => {
    if (value !== undefined) filters[key] = value;
  };

  setIf('category', asArray(query['category']));
  setIf('subcategory', asArray(query['subcategory']));
  setIf('brandId', asArray(query['brand_id']));
  setIf('color', asArray(query['color']));
  setIf('size', asArray(query['size']));
  setIf('season', asArray(query['season']));
  setIf('occasion', asArray(query['occasion']));
  setIf('material', asArray(query['material']));
  setIf('styleTag', asArray(query['style_tag']));
  setIf('retailer', asArray(query['retailer']));
  setIf('status', asArray(query['status']));
  setIf('favorite', asBoolean(query['favorite']));
  setIf('tagsAttached', asBoolean(query['tags_attached']));
  setIf('neverWorn', asBoolean(query['never_worn']));
  setIf('notWornSinceDays', asNumber(query['not_worn_since_days']));
  setIf('addedWithinDays', asNumber(query['added_within_days']));
  setIf('priceMin', asNumber(query['price_min']));
  setIf('priceMax', asNumber(query['price_max']));
  if (query['purchased_after']) filters.purchasedAfter = String(query['purchased_after']);
  if (query['purchased_before']) filters.purchasedBefore = String(query['purchased_before']);

  return {
    filters,
    sort: rawSort as SortKey,
    limit: rawLimit,
    cursor: query['cursor'] ? String(query['cursor']) : null,
  };
}

const nullableString = z.string().trim().min(1).max(200).nullable().optional();

const GarmentBodySchema = z.object({
  name: z.string().trim().max(200).nullable().optional(),
  brand_raw: nullableString,
  category: z.string(),
  subcategory: z.string().nullable().optional(),
  primary_color: z.string().nullable().optional(),
  secondary_colors: z.array(z.string()).max(8).optional(),
  pattern: z.string().nullable().optional(),
  materials: z.array(z.string()).max(8).optional(),
  size_raw: nullableString,
  size_normalized: nullableString,
  size_system: nullableString,
  fit: z.string().nullable().optional(),
  season: z.array(z.string()).max(4).optional(),
  occasion: z.array(z.string()).max(16).optional(),
  style_tags: z.array(z.string()).max(16).optional(),
  purchase_date: z.string().date().nullable().optional(),
  purchase_price: z.number().nonnegative().nullable().optional(),
  currency: z.string().length(3).nullable().optional(),
  retailer: nullableString,
  sku: nullableString,
  barcode: nullableString,
  product_url: z.string().url().max(2048).nullable().optional(),
  tags_attached: z.boolean().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  source_type: z.string().optional(),
  source_reference: nullableString,
});

const GarmentUpdateSchema = GarmentBodySchema.partial();

/**
 * The user's answer to the duplicate sheet (`duplicate-detection.md` §4).
 *
 * `same_item` merges into the named garment and creates nothing; the other two
 * both create, and differ only in what they record about the pair — which is
 * the whole point, because `different` is the negative that makes precision
 * measurable (§7).
 */
const DuplicateResolutionSchema = z.object({
  garment_id: z.string().uuid(),
  relation: z.enum(['same_item', 'owns_two', 'different']),
});

const CreateGarmentSchema = GarmentBodySchema.extend({
  duplicate_resolution: DuplicateResolutionSchema.optional(),
});

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw validationFailed(
      result.error.issues.map((issue) => ({
        field: issue.path.join('.') || '(root)',
        issue: issue.message,
      })),
    );
  }
  return result.data;
}

type GarmentBody = z.infer<typeof GarmentBodySchema>;

/**
 * The create payload, in the service's shape.
 *
 * Shared by `POST /garments` and `POST /garments/check-duplicate` because the
 * contract says the check "accepts the same payload a create would" — and a
 * check that read one field differently from the create that follows it would
 * clear a garment it then went on to duplicate.
 */
function toCreateInput(body: GarmentBody) {
  return {
    name: body.name ?? null,
    brandRaw: body.brand_raw ?? null,
    category: body.category,
    subcategory: body.subcategory ?? null,
    primaryColor: body.primary_color ?? null,
    secondaryColors: body.secondary_colors ?? [],
    pattern: body.pattern ?? null,
    materials: body.materials ?? [],
    sizeRaw: body.size_raw ?? null,
    sizeNormalized: body.size_normalized ?? null,
    sizeSystem: body.size_system ?? null,
    fit: body.fit ?? null,
    season: body.season ?? [],
    occasion: body.occasion ?? [],
    styleTags: body.style_tags ?? [],
    purchaseDate: body.purchase_date ?? null,
    purchasePrice: body.purchase_price ?? null,
    currency: body.currency ?? null,
    retailer: body.retailer ?? null,
    sku: body.sku ?? null,
    barcode: body.barcode ?? null,
    productUrl: body.product_url ?? null,
    sourceType: body.source_type ?? 'manual',
    sourceReference: body.source_reference ?? null,
    tagsAttached: body.tags_attached ?? null,
    notes: body.notes ?? null,
  };
}

export type ClosetRouteDeps = {
  service: ClosetService;
  identity: IdentityRepository;
};

export async function registerClosetRoutes(
  app: FastifyInstance,
  deps: ClosetRouteDeps,
): Promise<void> {
  const { service, identity } = deps;

  app.get('/closet', { onRequest: requireAuth }, async (request) => {
    return service.summary(requireScope(request));
  });

  /**
   * What this closet can be filtered by: its brands and its sizes.
   *
   * §16's sheet wants a searchable brand list and size chips, and the useful
   * lists are the ones the user owns — offering every brand Mira knows about
   * would let someone filter to a brand they have none of and see an empty
   * grid with no explanation.
   */
  app.get('/closet/facets', { onRequest: requireAuth }, async (request) => {
    return service.facets(requireScope(request));
  });

  app.get('/garments', { onRequest: requireAuth }, async (request) => {
    const params = parseListQuery(request.query as Record<string, unknown>);
    return service.list(requireScope(request), params);
  });

  app.get('/garments/count', { onRequest: requireAuth }, async (request) => {
    const params = parseListQuery(request.query as Record<string, unknown>);
    // Powers the filter sheet's live "Show N items" CTA
    // (docs/02-design/screen-specs.md §16).
    return { count: await service.count(requireScope(request), params.filters) };
  });

  /**
   * What Mira knows about each field, and how sure it is.
   *
   * Powers the AI Item Review screen (`screen-specs.md` §12), which renders a
   * tick, a statement, a question or an empty row depending on the band —
   * never the number itself (D-011).
   */
  app.get('/garments/:id/attributes', { onRequest: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return { data: await service.attributes(requireScope(request), id) };
  });

  app.post('/garments', { onRequest: requireAuth }, async (request, reply) => {
    // Idempotency-Key is required on every creating POST, so a retried request
    // cannot create a duplicate (docs/05-api/api-contract.md — Conventions).
    if (!request.headers['idempotency-key']) {
      throw new ApiError(400, ErrorCode.missingIdempotencyKey, {
        message: 'This request needs an Idempotency-Key header.',
      });
    }

    const body = parseBody(CreateGarmentSchema, request.body);
    const scope = requireScope(request);

    const closet =
      (await identity.findDefaultCloset(scope)) ?? (await identity.createDefaultCloset(scope));

    const { garment, created } = await service.createChecked(
      scope,
      closet.id,
      toCreateInput(body),
      body.duplicate_resolution
        ? {
            garmentId: body.duplicate_resolution.garment_id,
            relation: body.duplicate_resolution.relation,
          }
        : null,
    );

    // A merge did not create anything — it added to a garment that was already
    // there. 201 would tell the client to insert a second tile for a piece it
    // is already showing.
    return reply.status(created ? 201 : 200).send(garment);
  });

  /**
   * Is this already in the closet?
   *
   * Called by every ingestion path before writing (CAP-5,
   * `docs/05-api/api-contract.md`). Returns everything Mira noticed, including
   * the quiet band that does not interrupt a save — `band` says what to do with
   * each, so the caller never has to know the thresholds.
   */
  app.post('/garments/check-duplicate', { onRequest: requireAuth }, async (request) => {
    const body = parseBody(GarmentBodySchema, request.body);
    return {
      candidates: await service.checkDuplicates(requireScope(request), toCreateInput(body)),
    };
  });

  app.get('/garments/:id', { onRequest: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return service.get(requireScope(request), id);
  });

  app.patch('/garments/:id', { onRequest: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const raw = (request.body ?? {}) as Record<string, unknown>;

    // Provenance is immutable: how a garment entered Mira is never rewritten
    // by an edit (CAP-3).
    if ('source_type' in raw) {
      throw new ApiError(422, ErrorCode.immutableField, {
        details: [{ field: 'source_type', issue: 'provenance cannot be changed' }],
      });
    }

    const body = parseBody(GarmentUpdateSchema, raw);
    return service.update(requireScope(request), id, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.brand_raw !== undefined ? { brandRaw: body.brand_raw } : {}),
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.subcategory !== undefined ? { subcategory: body.subcategory } : {}),
      ...(body.primary_color !== undefined ? { primaryColor: body.primary_color } : {}),
      ...(body.secondary_colors !== undefined ? { secondaryColors: body.secondary_colors } : {}),
      ...(body.pattern !== undefined ? { pattern: body.pattern } : {}),
      ...(body.materials !== undefined ? { materials: body.materials } : {}),
      ...(body.size_raw !== undefined ? { sizeRaw: body.size_raw } : {}),
      ...(body.size_normalized !== undefined ? { sizeNormalized: body.size_normalized } : {}),
      ...(body.size_system !== undefined ? { sizeSystem: body.size_system } : {}),
      ...(body.fit !== undefined ? { fit: body.fit } : {}),
      ...(body.season !== undefined ? { season: body.season } : {}),
      ...(body.occasion !== undefined ? { occasion: body.occasion } : {}),
      ...(body.style_tags !== undefined ? { styleTags: body.style_tags } : {}),
      ...(body.purchase_date !== undefined ? { purchaseDate: body.purchase_date } : {}),
      ...(body.purchase_price !== undefined ? { purchasePrice: body.purchase_price } : {}),
      ...(body.currency !== undefined ? { currency: body.currency } : {}),
      ...(body.retailer !== undefined ? { retailer: body.retailer } : {}),
      ...(body.sku !== undefined ? { sku: body.sku } : {}),
      ...(body.barcode !== undefined ? { barcode: body.barcode } : {}),
      ...(body.product_url !== undefined ? { productUrl: body.product_url } : {}),
      ...(body.tags_attached !== undefined ? { tagsAttached: body.tags_attached } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    });
  });

  app.delete('/garments/:id', { onRequest: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await service.remove(requireScope(request), id);
    return reply.status(204).send();
  });

  /**
   * Acknowledge a garment Mira added on its own (F-05).
   *
   * The closet flags auto-imports until this is called. It clears on being
   * seen, not on the undo window expiring.
   */
  app.post('/garments/:id/acknowledge', { onRequest: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return service.acknowledgeAutoImport(requireScope(request), id);
  });

  app.post('/garments/:id/restore', { onRequest: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return service.restore(requireScope(request), id);
  });

  app.post('/garments/:id/favorite', { onRequest: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const body = parseBody(z.object({ favorite: z.boolean() }), request.body);
    return service.setFavorite(requireScope(request), id, body.favorite);
  });

  app.post('/garments/:id/status', { onRequest: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const body = parseBody(z.object({ status: z.string() }), request.body);
    return service.setStatus(requireScope(request), id, body.status);
  });
}
