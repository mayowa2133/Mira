/**
 * Closet service.
 *
 * Business rules live here — taxonomy validation, status transitions, brand
 * resolution and serialization. Routes validate and delegate; repositories run
 * SQL (`docs/03-architecture/backend-architecture.md` §1).
 */
import {
  CONFIDENCE,
  confidenceBand,
  isCategory,
  isGarmentStatus,
  isSubcategoryOf,
  type GarmentStatus,
} from '@mira/taxonomy';
import type { UserScope } from '../../db/scope.js';
import { ApiError, ErrorCode, internal, notFound, validationFailed } from '../../http/errors.js';
import type { StorageDriver } from '@mira/storage';
import {
  GarmentRepository,
  subcategoryFromRowId,
  type CreateGarmentInput,
  type GarmentImageRow,
  type GarmentRow,
  type ListParams,
  type UpdateGarmentInput,
} from './repository.js';
import { validateFilters, type GarmentFilters, type SortKey } from './filters.js';
import {
  interrupts,
  type DuplicateCandidateView,
  type DuplicateService,
} from './duplicate-service.js';
import { subjectFromInput } from './duplicate-subject.js';

export type SerializedGarment = ReturnType<typeof serializeGarmentSync>;

/**
 * Statuses a user may set directly from the app.
 *
 * `returned`, `sold` and `donated` are reachable only through the flows that
 * own them, so a stray PATCH cannot quietly rewrite purchase history.
 */
const USER_SETTABLE_STATUSES: readonly GarmentStatus[] = [
  'active',
  'laundry',
  'unavailable',
  'lent_out',
  'lost',
  'archived',
];

function money(amount: string | null, currency: string | null) {
  if (amount === null || currency === null) return null;
  return { amount: Number(amount), currency };
}

/**
 * One image, in the shape `docs/05-api/api-contract.md` documents.
 *
 * `thumb_url` and `medium_url` are null until `image.process` has run, or if
 * derivative generation failed — clients fall back to `url` rather than showing
 * nothing (`image-processing.md` §8).
 */
function serializeImage(image: {
  id: string;
  kind: string;
  url: string;
  thumbUrl: string | null;
  mediumUrl: string | null;
  urlExpiresAt: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  isCanonical: boolean;
  position: number;
}) {
  return {
    id: image.id,
    kind: image.kind,
    url: image.url,
    thumb_url: image.thumbUrl,
    medium_url: image.mediumUrl,
    url_expires_at: image.urlExpiresAt,
    width: image.width,
    height: image.height,
    blurhash: image.blurhash,
    is_canonical: image.isCanonical,
    position: image.position,
  };
}

function serializeGarmentSync(
  row: GarmentRow,
  images: {
    id: string;
    kind: string;
    url: string;
    thumbUrl: string | null;
    mediumUrl: string | null;
    urlExpiresAt: string;
    width: number | null;
    height: number | null;
    blurhash: string | null;
    isCanonical: boolean;
    position: number;
  }[],
) {
  const price = money(row.purchase_price, row.currency);

  // Cost per wear is computed server-side so the client never divides by zero
  // and never has to decide what "no price" means.
  const costPerWear =
    price && row.worn_count > 0
      ? {
          amount: Math.round((price.amount / row.worn_count) * 100) / 100,
          currency: price.currency,
        }
      : null;

  return {
    id: row.id,
    closet_id: row.closet_id,
    name: row.name,
    brand: row.brand_id ? { id: row.brand_id, name: row.brand_name ?? '', logo_url: null } : null,
    brand_raw: row.brand_raw,
    category: row.category,
    subcategory: subcategoryFromRowId(row.subcategory),
    primary_color: row.primary_color,
    secondary_colors: row.secondary_colors,
    pattern: row.pattern,
    materials: row.materials,
    size: {
      raw: row.size_raw,
      normalized: row.size_normalized,
      system: row.size_system,
    },
    fit: row.fit,
    season: row.season,
    occasion: row.occasion,
    style_tags: row.style_tags,
    purchase: {
      date: row.purchase_date ? row.purchase_date.toISOString().slice(0, 10) : null,
      price,
      retailer: row.retailer,
    },
    identifiers: {
      sku: row.sku,
      barcode: row.barcode,
      product_url: row.product_url,
    },
    // Provenance is immutable and always reported (CAP-3).
    source: { type: row.source_type, reference: row.source_reference },
    status: row.status,
    favorite: row.favorite,
    tags_attached: row.tags_attached,
    notes: row.notes,
    wear: {
      count: row.worn_count,
      last_worn_at: row.last_worn_at?.toISOString() ?? null,
      cost_per_wear: costPerWear,
    },
    // Serialized here rather than passed through: the contract is snake_case,
    // and `isCanonical` was leaking camelCase into responses.
    images: images.map(serializeImage),
    canonical_image: (() => {
      const canonical = images.find((i) => i.isCanonical) ?? images[0] ?? null;
      return canonical ? serializeImage(canonical) : null;
    })(),
    analysis_state: row.analysis_state,
    ai_confidence: row.ai_confidence === null ? null : Number(row.ai_confidence),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

/**
 * Turn an edit into the corrections it represents.
 *
 * Only fields the model also produces are recorded: a correction is meaningful
 * as a comparison against what Mira said, and recording `notes` as a
 * "correction" would dilute the signal the alarm depends on.
 */
function correctionsFrom(input: UpdateGarmentInput): { field: string; value: unknown }[] {
  const out: { field: string; value: unknown }[] = [];

  const record = (field: string, value: unknown) => {
    if (value !== undefined) out.push({ field, value });
  };

  record('category', input.category);
  record('subcategory', input.subcategory);
  record('brand', input.brandRaw);
  record('pattern', input.pattern);
  record('fit', input.fit);
  record('materials', input.materials);
  record('season', input.season);
  record('occasion', input.occasion);
  record('style', input.styleTags);
  record('size', input.sizeRaw);

  return out;
}

/** The user's answer to the duplicate sheet (`duplicate-detection.md` §4). */
export type DuplicateResolution = {
  garmentId: string;
  relation: 'same_item' | 'owns_two' | 'different';
};

export class ClosetService {
  constructor(
    private readonly repo: GarmentRepository,
    private readonly storage: StorageDriver,
    /**
     * Absent only where there is no closet to compare against — the tests that
     * exercise serialization on its own. Every real path has it, because CAP-5
     * makes the check part of creating a garment rather than a step beside it.
     */
    private readonly duplicates: DuplicateService | null = null,
  ) {}

  /** Sign and shape rows the caller already has. */
  async serializeRows(scope: UserScope, rows: GarmentRow[]): Promise<SerializedGarment[]> {
    return this.serialize(scope, rows);
  }

  /** Sign every image URL for a page of garments in one pass. */
  private async serialize(scope: UserScope, rows: GarmentRow[]) {
    const imageRows = await this.repo.imagesFor(
      scope,
      rows.map((r) => r.id),
    );

    const byGarment = new Map<string, GarmentImageRow[]>();
    for (const image of imageRows) {
      const list = byGarment.get(image.garment_id) ?? [];
      list.push(image);
      byGarment.set(image.garment_id, list);
    }

    return Promise.all(
      rows.map(async (row) => {
        const images = await Promise.all(
          (byGarment.get(row.id) ?? []).map(async (image) => {
            // Every variant is signed for THIS user. A derivative is as
            // private as the photograph it came from (SEC-4).
            const [signed, thumb, medium] = await Promise.all([
              this.storage.signedReadUrl(image.storage_key, scope.userId),
              image.thumb_key ? this.storage.signedReadUrl(image.thumb_key, scope.userId) : null,
              image.medium_key ? this.storage.signedReadUrl(image.medium_key, scope.userId) : null,
            ]);

            return {
              id: image.id,
              kind: image.kind,
              url: signed.url,
              // Null until image.process has run, or if it failed. Clients fall
              // back to `url` rather than showing nothing (§8).
              thumbUrl: thumb?.url ?? null,
              mediumUrl: medium?.url ?? null,
              urlExpiresAt: signed.expiresAt,
              width: image.width,
              height: image.height,
              blurhash: image.blurhash,
              isCanonical: image.is_canonical,
              position: image.position,
            };
          }),
        );
        return serializeGarmentSync(row, images);
      }),
    );
  }

  /**
   * Apply the closet's default visibility.
   *
   * The closet does not show archived pieces unless asked
   * (`docs/05-api/api-contract.md` — GET /garments).
   *
   * Shared by `list` and `count` so they can never disagree: the filter sheet's
   * "Show N items" CTA must promise exactly what the grid then shows
   * (`docs/02-design/screen-specs.md` §16).
   */
  private applyDefaults(filters: GarmentFilters): GarmentFilters {
    if (filters.status?.length) return filters;
    return { ...filters, status: USER_SETTABLE_STATUSES.filter((s) => s !== 'archived') };
  }

  async list(
    scope: UserScope,
    params: { filters: GarmentFilters; sort: SortKey; limit: number; cursor: string | null },
  ) {
    validateFilters(params.filters);
    const listParams: ListParams = { ...params, filters: this.applyDefaults(params.filters) };
    const { rows, nextCursor } = await this.repo.list(scope, listParams);
    return { data: await this.serialize(scope, rows), next_cursor: nextCursor };
  }

  async count(scope: UserScope, filters: GarmentFilters): Promise<number> {
    validateFilters(filters);
    return this.repo.count(scope, this.applyDefaults(filters));
  }

  async summary(scope: UserScope) {
    const [byCategory, recentPage] = await Promise.all([
      this.repo.countsByCategory(scope),
      this.repo.list(scope, {
        filters: { status: [...USER_SETTABLE_STATUSES] },
        sort: 'recent',
        limit: 8,
        cursor: null,
      }),
    ]);

    return {
      total: byCategory.reduce((sum, row) => sum + row.count, 0),
      by_category: byCategory,
      recently_added: await this.serialize(scope, recentPage.rows),
    };
  }

  async get(scope: UserScope, id: string) {
    const row = await this.repo.findById(scope, id);
    // A garment that exists but belongs to another user is INVISIBLE, so this
    // is a 404 rather than a 403 (SEC-5, docs/05-api/error-contract.md).
    if (!row) throw notFound(ErrorCode.garmentNotFound);
    const [serialized] = await this.serialize(scope, [row]);
    // One row in, one out. The index is only optional to the type system, and
    // leaving it that way made every caller's return type nullable for a case
    // that cannot happen.
    if (!serialized) throw internal();
    return serialized;
  }

  /** Validate the category/subcategory pair against the canonical taxonomy. */
  private assertTaxonomy(category: string, subcategory: string | null | undefined): void {
    if (!isCategory(category)) {
      throw new ApiError(422, ErrorCode.notInTaxonomy, {
        details: [{ field: 'category', issue: `"${category}" is not in the taxonomy` }],
      });
    }
    if (subcategory && !isSubcategoryOf(category, subcategory)) {
      throw new ApiError(422, ErrorCode.subcategoryMismatch, {
        details: [
          { field: 'subcategory', issue: `"${subcategory}" does not belong to "${category}"` },
        ],
      });
    }
  }

  async create(scope: UserScope, closetId: string, input: Omit<CreateGarmentInput, 'closetId'>) {
    this.assertTaxonomy(input.category, input.subcategory);

    const row = await this.repo.create(scope, { ...input, closetId });

    // Brand resolution is best-effort: an unrecognized brand stays on the
    // garment as brand_raw rather than blocking creation (CAP-4).
    if (input.brandRaw) {
      const brand = await this.repo.resolveBrand(input.brandRaw);
      if (brand) await this.repo.attachBrand(scope, row.id, brand.id);
    }

    return this.get(scope, row.id);
  }

  /**
   * What this payload might already be, without creating anything.
   *
   * Every band is returned, `note` included, because the caller that shows the
   * sheet and the caller that quietly records "you might already own this" are
   * asking the same question and should not each re-derive the thresholds.
   */
  async checkDuplicates(
    scope: UserScope,
    input: Omit<CreateGarmentInput, 'closetId'>,
  ): Promise<DuplicateCandidateView[]> {
    this.assertTaxonomy(input.category, input.subcategory);
    if (!this.duplicates) return [];
    return this.duplicates.check(scope, subjectFromInput(input));
  }

  /**
   * Create a garment, having first asked whether it is already in the closet.
   *
   * CAP-5: duplicate detection runs before every garment creation, from every
   * ingestion path. It runs here rather than in the route so that no path can
   * reach `create` without passing through it.
   *
   * Without a resolution, a candidate in an interrupting band stops the save
   * with `duplicate_unresolved` (409). That is a safety net rather than the
   * normal flow: a client is expected to call `check-duplicate` first and show
   * the sheet, which is why the 409 carries only the candidate ids and not the
   * whole sheet — the path that needs the images has already fetched them.
   */
  async createChecked(
    scope: UserScope,
    closetId: string,
    input: Omit<CreateGarmentInput, 'closetId'>,
    resolution: DuplicateResolution | null,
  ): Promise<{ garment: SerializedGarment; created: boolean }> {
    this.assertTaxonomy(input.category, input.subcategory);

    const candidates = this.duplicates
      ? await this.duplicates.check(scope, subjectFromInput(input))
      : [];

    if (!resolution) {
      const asking = candidates.filter((candidate) => interrupts(candidate.band));
      if (asking.length > 0) {
        throw new ApiError(409, ErrorCode.duplicateUnresolved, {
          details: asking.map((candidate) => ({
            field: 'duplicate_resolution',
            issue: `${candidate.existing_garment.id}: ${candidate.summary}`,
          })),
        });
      }
      return { garment: await this.create(scope, closetId, input), created: true };
    }

    // The sheet only ever offers candidates, but a resolution is honoured for
    // any garment the user owns: between showing the sheet and answering it,
    // the closet can change, and rejecting an answer the user actually gave is
    // worse than merging into a garment that stopped scoring.
    const target = await this.repo.findById(scope, resolution.garmentId);
    if (!target) throw notFound(ErrorCode.garmentNotFound);

    const score =
      candidates.find((c) => c.existing_garment.id === resolution.garmentId)?.score ?? null;

    if (resolution.relation === 'same_item') {
      return { garment: await this.mergeInto(scope, target, input), created: false };
    }

    const garment = await this.create(scope, closetId, input);

    // Both remaining answers are the user saying "these are two garments". The
    // negative is recorded as carefully as the positive: §7 measures precision
    // against it, and without it a false-duplicate rate cannot be computed.
    if (this.duplicates) {
      await this.duplicates.record(scope, {
        garmentA: garment.id,
        garmentB: target.id,
        relation: resolution.relation,
        score,
      });
    }

    return { garment, created: true };
  }

  /**
   * Fold a garment that was never created into the one it duplicates.
   *
   * §5: "Merging never destroys information." So this only fills fields the
   * surviving garment has nothing in — it never overwrites a value that is
   * already there.
   *
   * That is narrower than the full precedence rule in
   * `garment-understanding.md` §3, deliberately. Resolving precedence per field
   * needs each field's source, which lives in `garment_attributes`; and today
   * the only sources that can meet here are the user and vision inference,
   * where the rule already says the existing value stands. Tag OCR and product
   * matching are the sources that will make precedence matter, and they arrive
   * with Phase 4 and 3.7 (D-025).
   */
  private async mergeInto(
    scope: UserScope,
    target: GarmentRow,
    input: Omit<CreateGarmentInput, 'closetId'>,
  ): Promise<SerializedGarment> {
    const patch: UpdateGarmentInput = {};

    const fill = <K extends keyof UpdateGarmentInput>(
      key: K,
      existing: unknown,
      incoming: UpdateGarmentInput[K],
    ) => {
      const empty =
        existing === null ||
        existing === undefined ||
        (Array.isArray(existing) && existing.length === 0);
      const hasIncoming =
        incoming !== null &&
        incoming !== undefined &&
        !(Array.isArray(incoming) && incoming.length === 0);
      if (empty && hasIncoming) patch[key] = incoming;
    };

    fill('name', target.name, input.name);
    fill('brandRaw', target.brand_raw ?? target.brand_id, input.brandRaw);
    fill('primaryColor', target.primary_color, input.primaryColor);
    fill('secondaryColors', target.secondary_colors, input.secondaryColors);
    fill('pattern', target.pattern, input.pattern);
    fill('materials', target.materials, input.materials);
    fill('sizeRaw', target.size_raw, input.sizeRaw);
    fill('sizeNormalized', target.size_normalized, input.sizeNormalized);
    fill('sizeSystem', target.size_system, input.sizeSystem);
    fill('fit', target.fit, input.fit);
    fill('season', target.season, input.season);
    fill('occasion', target.occasion, input.occasion);
    fill('styleTags', target.style_tags, input.styleTags);
    fill('purchaseDate', target.purchase_date, input.purchaseDate);
    fill('retailer', target.retailer, input.retailer);
    fill('sku', target.sku, input.sku);
    fill('barcode', target.barcode, input.barcode);
    fill('productUrl', target.product_url, input.productUrl);
    fill('tagsAttached', target.tags_attached, input.tagsAttached);
    fill('notes', target.notes, input.notes);

    // Price and currency move together or not at all: the schema refuses a
    // price without a currency, and half a purchase record is worse than none.
    if (target.purchase_price === null && input.purchasePrice !== null && input.currency) {
      patch.purchasePrice = input.purchasePrice;
      patch.currency = input.currency;
    }

    // A subcategory only means anything under its own category.
    if (!target.subcategory && input.subcategory && target.category === input.category) {
      patch.subcategory = input.subcategory;
    }

    if (Object.keys(patch).length > 0) {
      await this.repo.update(scope, target.id, patch);
      if (patch.brandRaw) {
        const brand = await this.repo.resolveBrand(patch.brandRaw);
        if (brand) await this.repo.attachBrand(scope, target.id, brand.id);
      }
    }

    // How the extra information arrived is provenance, and provenance is
    // append-only (CAP-3). Without this row the merge is invisible: the garment
    // would carry a receipt's price with no record of the receipt.
    await this.repo.recordSource(scope, target.id, {
      sourceType: input.sourceType,
      referenceId: input.sourceReference,
      referenceKind: 'merged_duplicate',
      metadata: { fields: Object.keys(patch) },
    });

    return this.get(scope, target.id);
  }

  async update(scope: UserScope, id: string, input: UpdateGarmentInput) {
    if (input.category !== undefined) {
      this.assertTaxonomy(input.category, input.subcategory ?? null);
    } else if (input.subcategory !== undefined && input.subcategory !== null) {
      const existing = await this.repo.findById(scope, id);
      if (!existing) throw notFound(ErrorCode.garmentNotFound);
      this.assertTaxonomy(existing.category, input.subcategory);
    }

    const row = await this.repo.update(scope, id, input);
    if (!row) throw notFound(ErrorCode.garmentNotFound);

    // A correction is the most valuable signal the product collects
    // (ai-product-spec.md §4): it is recorded as a user-sourced value that wins
    // permanently, beside the AI value rather than on top of it.
    const corrections = correctionsFrom(input);
    if (corrections.length > 0) await this.repo.recordCorrections(scope, id, corrections);

    if (input.brandRaw) {
      const brand = await this.repo.resolveBrand(input.brandRaw);
      if (brand) await this.repo.attachBrand(scope, id, brand.id);
    }

    return this.get(scope, id);
  }

  /**
   * What is known about each field, as bands rather than numbers.
   *
   * D-011: bands, not raw numbers, reach the UI. A user should never see
   * "0.72" — it invites arguing with a number instead of correcting a value.
   */
  async attributes(scope: UserScope, id: string) {
    const garment = await this.repo.findById(scope, id);
    if (!garment) throw notFound(ErrorCode.garmentNotFound);

    const rows = await this.repo.attributesFor(scope, id);

    // Newest first, so the first row for a field is the value in force. A user
    // correction therefore shadows the AI value without deleting it.
    const seen = new Set<string>();
    const current: {
      field: string;
      value: unknown;
      band: string;
      source: string;
      superseded: { value: unknown; band: string; source: string } | null;
    }[] = [];

    for (const row of rows) {
      if (seen.has(row.field)) continue;
      seen.add(row.field);

      const older = rows.find((other) => other.field === row.field && other !== row);

      current.push({
        field: row.field,
        value: row.value,
        band: confidenceBand(Number(row.confidence)),
        source: row.source,
        superseded: older
          ? {
              value: older.value,
              band: confidenceBand(Number(older.confidence)),
              source: older.source,
            }
          : null,
      });
    }

    return current;
  }

  async setFavorite(scope: UserScope, id: string, favorite: boolean) {
    const row = await this.repo.setFavorite(scope, id, favorite);
    if (!row) throw notFound(ErrorCode.garmentNotFound);
    return this.get(scope, id);
  }

  async setStatus(scope: UserScope, id: string, status: string) {
    if (!isGarmentStatus(status)) {
      throw new ApiError(422, ErrorCode.notInTaxonomy, {
        details: [{ field: 'status', issue: `"${status}" is not a garment status` }],
      });
    }
    if (!USER_SETTABLE_STATUSES.includes(status)) {
      throw new ApiError(422, ErrorCode.invalidStatusTransition, {
        details: [
          {
            field: 'status',
            issue: `"${status}" is set by the flow that owns it, not directly`,
          },
        ],
      });
    }

    const row = await this.repo.setStatus(scope, id, status);
    if (!row) throw notFound(ErrorCode.garmentNotFound);
    return this.get(scope, id);
  }

  async remove(scope: UserScope, id: string): Promise<void> {
    const removed = await this.repo.softDelete(scope, id);
    if (!removed) throw notFound(ErrorCode.garmentNotFound);
  }

  async restore(scope: UserScope, id: string) {
    const row = await this.repo.restore(scope, id);
    if (!row) throw notFound(ErrorCode.garmentNotFound);
    return this.get(scope, id);
  }
}

export { validationFailed, CONFIDENCE };
