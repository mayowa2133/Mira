import {
  type Category,
  type Color,
  type Occasion,
  type Season,
  type StyleTag,
  type Subcategory,
  isCategory,
  isColor,
  isOccasion,
  isSeason,
  isStyleTag,
  isSubcategory,
  isSubcategoryOf,
} from './generated.js';

/**
 * Records one value that was dropped because it is not in the taxonomy.
 * Emitted as the `ai_taxonomy_clamped` analytics event, which is a quality
 * alarm: a rise means a prompt or model regression
 * (`docs/05-api/events.md`, `docs/06-ai/ai-product-spec.md` R3).
 */
export type ClampDrop = {
  field: string;
  value: unknown;
  reason: 'not_in_taxonomy' | 'subcategory_mismatch';
};

export type ClampResult<T> = {
  value: T;
  drops: ClampDrop[];
};

/**
 * Clamp a single value to a taxonomy set.
 *
 * An unknown value is DROPPED, never mapped to the nearest neighbour and never
 * added as a new value (`docs/06-ai/ai-product-spec.md` R3).
 */
export function clampValue<T>(
  field: string,
  value: unknown,
  guard: (v: unknown) => v is T,
): ClampResult<T | null> {
  if (value === null || value === undefined) return { value: null, drops: [] };
  if (guard(value)) return { value, drops: [] };
  return { value: null, drops: [{ field, value, reason: 'not_in_taxonomy' }] };
}

/** Clamp an array, dropping every value that is not in the taxonomy. */
export function clampArray<T>(
  field: string,
  values: unknown,
  guard: (v: unknown) => v is T,
): ClampResult<T[]> {
  if (!Array.isArray(values)) return { value: [], drops: [] };
  const kept: T[] = [];
  const drops: ClampDrop[] = [];
  for (const v of values) {
    if (guard(v)) kept.push(v);
    else drops.push({ field, value: v, reason: 'not_in_taxonomy' });
  }
  return { value: kept, drops };
}

/**
 * Clamp a category/subcategory pair.
 *
 * A subcategory that does not belong to its category is dropped — `dresses/heels`
 * is invalid (taxonomy §1). An unknown category drops the subcategory too,
 * because it cannot be validated.
 */
export function clampCategoryPair(
  rawCategory: unknown,
  rawSubcategory: unknown,
): ClampResult<{ category: Category | null; subcategory: Subcategory | null }> {
  const drops: ClampDrop[] = [];

  const cat = clampValue('category', rawCategory, isCategory);
  drops.push(...cat.drops);

  if (cat.value === null) {
    if (rawSubcategory !== null && rawSubcategory !== undefined) {
      drops.push({ field: 'subcategory', value: rawSubcategory, reason: 'not_in_taxonomy' });
    }
    return { value: { category: null, subcategory: null }, drops };
  }

  const sub = clampValue('subcategory', rawSubcategory, isSubcategory);
  drops.push(...sub.drops);

  if (sub.value !== null && !isSubcategoryOf(cat.value, sub.value)) {
    drops.push({
      field: 'subcategory',
      value: sub.value,
      reason: 'subcategory_mismatch',
    });
    return { value: { category: cat.value, subcategory: null }, drops };
  }

  return { value: { category: cat.value, subcategory: sub.value }, drops };
}

/** Normalize a confidence value into [0,1]. Non-numeric input yields null. */
export function normalizeConfidence(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Convenience clamps for the sets used most often on the ingestion path. */
export const clampColors = (v: unknown) => clampArray<Color>('colors', v, isColor);
export const clampSeasons = (v: unknown) => clampArray<Season>('season', v, isSeason);
export const clampOccasions = (v: unknown) => clampArray<Occasion>('occasion', v, isOccasion);
export const clampStyleTags = (v: unknown) => clampArray<StyleTag>('style_tags', v, isStyleTag);
