/**
 * Closet filter parsing and SQL construction.
 *
 * All filters combine with AND; array values OR within their own field
 * (INV-3, `docs/04-data/data-models.md` — GarmentFilters).
 *
 * Every enumerated value is validated against the canonical taxonomy before it
 * reaches SQL. An unknown value is a 422, not a silently-empty result set: the
 * user asked for something Mira has no name for, and saying so is more honest
 * than returning nothing.
 */
import {
  isCategory,
  isColor,
  isGarmentStatus,
  isMaterial,
  isOccasion,
  isSeason,
  isStyleTag,
  isSubcategory,
} from '@mira/taxonomy';
import { ApiError, ErrorCode, validationFailed } from '../../http/errors.js';

export type SortKey =
  'recent' | 'recently_worn' | 'never_worn' | 'brand' | 'color' | 'price_desc' | 'price_asc';

export const SORT_KEYS: readonly SortKey[] = [
  'recent',
  'recently_worn',
  'never_worn',
  'brand',
  'color',
  'price_desc',
  'price_asc',
];

export type GarmentFilters = {
  category?: string[];
  subcategory?: string[];
  brandId?: string[];
  color?: string[];
  size?: string[];
  season?: string[];
  occasion?: string[];
  material?: string[];
  styleTag?: string[];
  retailer?: string[];
  status?: string[];
  favorite?: boolean;
  tagsAttached?: boolean;
  neverWorn?: boolean;
  notWornSinceDays?: number;
  purchasedAfter?: string;
  purchasedBefore?: string;
  priceMin?: number;
  priceMax?: number;
};

type Guard = (v: unknown) => boolean;

function validateSet(field: string, values: string[] | undefined, guard: Guard): void {
  if (!values) return;
  const invalid = values.filter((v) => !guard(v));
  if (invalid.length > 0) {
    throw new ApiError(422, ErrorCode.notInTaxonomy, {
      details: invalid.map((value) => ({ field, issue: `"${value}" is not in the taxonomy` })),
    });
  }
}

/** Reject anything outside the canonical taxonomy before it reaches SQL (AI-3, INV-1). */
export function validateFilters(filters: GarmentFilters): void {
  validateSet('category', filters.category, isCategory);
  validateSet('subcategory', filters.subcategory, isSubcategory);
  validateSet('color', filters.color, isColor);
  validateSet('season', filters.season, isSeason);
  validateSet('occasion', filters.occasion, isOccasion);
  validateSet('material', filters.material, isMaterial);
  validateSet('style_tag', filters.styleTag, isStyleTag);
  validateSet('status', filters.status, isGarmentStatus);

  if (filters.priceMin !== undefined && filters.priceMax !== undefined) {
    if (filters.priceMin > filters.priceMax) {
      throw validationFailed([{ field: 'price_min', issue: 'must not exceed price_max' }]);
    }
  }
  if (filters.notWornSinceDays !== undefined && filters.notWornSinceDays <= 0) {
    throw validationFailed([{ field: 'not_worn_since_days', issue: 'must be positive' }]);
  }
}

export type SqlFragment = { clauses: string[]; values: unknown[] };

/**
 * Build the WHERE fragment.
 *
 * `startIndex` is the next free bind parameter, so the caller can place
 * `user_id = $1` first — which is what the scope guard checks for.
 */
export function buildFilterSql(filters: GarmentFilters, startIndex: number): SqlFragment {
  const clauses: string[] = [];
  const values: unknown[] = [];
  let i = startIndex;

  const arrayFilter = (column: string, list: string[] | undefined) => {
    if (!list?.length) return;
    clauses.push(`g.${column} = any($${i}::text[])`);
    values.push(list);
    i += 1;
  };

  // Array columns use overlap: "show me summer things" should still match a
  // garment tagged for both summer and autumn.
  const overlapFilter = (column: string, list: string[] | undefined) => {
    if (!list?.length) return;
    clauses.push(`g.${column} && $${i}::text[]`);
    values.push(list);
    i += 1;
  };

  arrayFilter('category', filters.category);
  arrayFilter('subcategory', filters.subcategory);
  arrayFilter('primary_color', filters.color);
  arrayFilter('size_normalized', filters.size);
  arrayFilter('retailer', filters.retailer);
  arrayFilter('status', filters.status);

  overlapFilter('season', filters.season);
  overlapFilter('occasion', filters.occasion);
  overlapFilter('materials', filters.material);
  overlapFilter('style_tags', filters.styleTag);

  if (filters.brandId?.length) {
    clauses.push(`g.brand_id = any($${i}::uuid[])`);
    values.push(filters.brandId);
    i += 1;
  }

  if (filters.favorite !== undefined) {
    clauses.push(`g.favorite = $${i}`);
    values.push(filters.favorite);
    i += 1;
  }

  if (filters.tagsAttached !== undefined) {
    clauses.push(`g.tags_attached is not distinct from $${i}`);
    values.push(filters.tagsAttached);
    i += 1;
  }

  if (filters.neverWorn === true) clauses.push('g.worn_count = 0');
  if (filters.neverWorn === false) clauses.push('g.worn_count > 0');

  if (filters.notWornSinceDays !== undefined) {
    // Never-worn garments qualify: not worn at all is a stronger version of the
    // same thing.
    clauses.push(
      `(g.last_worn_at is null or g.last_worn_at < now() - make_interval(days => $${i}))`,
    );
    values.push(filters.notWornSinceDays);
    i += 1;
  }

  if (filters.purchasedAfter) {
    clauses.push(`g.purchase_date >= $${i}`);
    values.push(filters.purchasedAfter);
    i += 1;
  }
  if (filters.purchasedBefore) {
    clauses.push(`g.purchase_date <= $${i}`);
    values.push(filters.purchasedBefore);
    i += 1;
  }
  if (filters.priceMin !== undefined) {
    clauses.push(`g.purchase_price >= $${i}`);
    values.push(filters.priceMin);
    i += 1;
  }
  if (filters.priceMax !== undefined) {
    clauses.push(`g.purchase_price <= $${i}`);
    values.push(filters.priceMax);
    i += 1;
  }

  return { clauses, values };
}

/**
 * Sort expressions.
 *
 * Every sort is tie-broken by id so keyset pagination is stable: without a
 * total order, a page boundary can drop or repeat a row.
 */
export function sortSql(sort: SortKey): { orderBy: string; keyColumn: string } {
  switch (sort) {
    case 'recently_worn':
      return { orderBy: 'g.last_worn_at desc nulls last, g.id desc', keyColumn: 'last_worn_at' };
    case 'never_worn':
      return { orderBy: 'g.worn_count asc, g.created_at desc, g.id desc', keyColumn: 'created_at' };
    case 'brand':
      return {
        orderBy: 'coalesce(b.name, g.brand_raw) asc nulls last, g.id desc',
        keyColumn: 'created_at',
      };
    case 'color':
      return { orderBy: 'g.primary_color asc nulls last, g.id desc', keyColumn: 'created_at' };
    case 'price_desc':
      return { orderBy: 'g.purchase_price desc nulls last, g.id desc', keyColumn: 'created_at' };
    case 'price_asc':
      return { orderBy: 'g.purchase_price asc nulls last, g.id desc', keyColumn: 'created_at' };
    case 'recent':
    default:
      return { orderBy: 'g.created_at desc, g.id desc', keyColumn: 'created_at' };
  }
}
