/**
 * Clamping a whole model response (`docs/06-ai/garment-understanding.md` §1).
 *
 * The per-field primitives live in `@mira/taxonomy` — this composes them over
 * an entire understanding, which is where the rule that matters applies:
 *
 * > Any value not in the taxonomy is **dropped** by the clamp step and logged
 * > as `ai_taxonomy_clamped`. It is never mapped to the nearest value.
 *
 * Two properties make this a step rather than a formality.
 *
 * **Dropped, not mapped.** Turning `"navy"` into `"blue"` looks helpful and is
 * how a wardrobe fills with quietly wrong data the user never said. A dropped
 * field is honest: the review screen shows an empty, tappable row (CAP-2).
 *
 * **Per field, not per response.** Validating the whole object against strict
 * enums means one unknown occasion costs the category, the colour and
 * everything else. §7 requires the opposite — clamp the value, continue the
 * pipeline. Losing an entire analysis to one stray string is the data loss the
 * spec forbids.
 */
import {
  type ClampDrop,
  clampArray,
  clampCategoryPair,
  clampValue,
  isColor,
  isFit,
  isLength,
  isMaterial,
  isNeckline,
  isOccasion,
  isPattern,
  isSeason,
  isSleeveLength,
  isSleeveType,
  isStyleTag,
  normalizeConfidence,
} from '@mira/taxonomy';

/** What a model may return, before anything about it is known to be valid. */
export type RawUnderstanding = Record<string, unknown>;

export type ClampedUnderstanding = {
  category: string;
  subcategory: string | null;
  brand: string | null;
  product_name: string | null;
  colors: string[];
  pattern: string | null;
  materials: string[];
  style: string[];
  fit: string | null;
  sleeve_length: string | null;
  sleeve_type: string | null;
  neckline: string | null;
  length: string | null;
  season: string[];
  occasion: string[];
  size: string | null;
  confidence: Record<string, number>;
};

export type ClampedResponse = {
  value: ClampedUnderstanding;
  /** Emit as `ai_taxonomy_clamped`; a rise is a model or prompt regression. */
  drops: ClampDrop[];
};

/** Free text, trimmed, with empty strings treated as absent. */
const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

/**
 * Confidence for fields that survived.
 *
 * A confidence about a value that was dropped describes nothing, so it is
 * removed with the value. Keeping it would let a clamped field arrive at the
 * review screen wearing a tick.
 */
function confidenceFor(raw: unknown, dropped: Set<string>): Record<string, number> {
  if (typeof raw !== 'object' || raw === null) return {};

  const out: Record<string, number> = {};
  for (const [field, value] of Object.entries(raw as Record<string, unknown>)) {
    if (dropped.has(field)) continue;
    const normalized = normalizeConfidence(value);
    if (normalized !== null) out[field] = normalized;
  }
  return out;
}

/**
 * Reduce a model response to values the taxonomy contains.
 *
 * `category` is the one field that cannot simply vanish: it is `not null` on
 * `garments`, and the garment must exist whatever the model said (REL-4). An
 * unknown or missing category becomes `other` — a real taxonomy member, not an
 * invented sentinel (D-019) — and the drop is still recorded, so a model
 * failing at categories shows up in the logs rather than hiding behind a
 * plausible default.
 */
export function clampUnderstanding(raw: RawUnderstanding): ClampedResponse {
  const drops: ClampDrop[] = [];

  const pair = clampCategoryPair(raw['category'], raw['subcategory']);
  drops.push(...pair.drops);

  const colors = clampArray('colors', raw['colors'], isColor);
  const materials = clampArray('materials', raw['materials'], isMaterial);
  const style = clampArray('style', raw['style'], isStyleTag);
  const season = clampArray('season', raw['season'], isSeason);
  const occasion = clampArray('occasion', raw['occasion'], isOccasion);
  const pattern = clampValue('pattern', raw['pattern'], isPattern);
  const fit = clampValue('fit', raw['fit'], isFit);
  const sleeveLength = clampValue('sleeve_length', raw['sleeve_length'], isSleeveLength);
  const sleeveType = clampValue('sleeve_type', raw['sleeve_type'], isSleeveType);
  const neckline = clampValue('neckline', raw['neckline'], isNeckline);
  const length = clampValue('length', raw['length'], isLength);

  for (const result of [
    colors,
    materials,
    style,
    season,
    occasion,
    pattern,
    fit,
    sleeveLength,
    sleeveType,
    neckline,
    length,
  ]) {
    drops.push(...result.drops);
  }

  // A field is "dropped" for confidence purposes when nothing of it survived.
  const dropped = new Set<string>();
  for (const drop of drops) dropped.add(drop.field);
  if (colors.value.length > 0) dropped.delete('colors');
  if (materials.value.length > 0) dropped.delete('materials');
  if (style.value.length > 0) dropped.delete('style');
  if (season.value.length > 0) dropped.delete('season');
  if (occasion.value.length > 0) dropped.delete('occasion');

  return {
    value: {
      category: pair.value.category ?? 'other',
      subcategory: pair.value.subcategory,
      // Free text by contract: a brand is whatever is on the label, and the
      // taxonomy does not enumerate brands. Never guessed from style (D-014).
      brand: text(raw['brand']),
      product_name: text(raw['product_name']),
      colors: colors.value,
      pattern: pattern.value,
      materials: materials.value,
      style: style.value,
      fit: fit.value,
      sleeve_length: sleeveLength.value,
      sleeve_type: sleeveType.value,
      neckline: neckline.value,
      length: length.value,
      season: season.value,
      occasion: occasion.value,
      // Only ever from a legible tag or a matched product.
      size: text(raw['size']),
      confidence: confidenceFor(raw['confidence'], dropped),
    },
    drops,
  };
}

/**
 * The last resort when a response cannot be understood at all.
 *
 * §7: "Model returns invalid JSON → retry once, then fall back to
 * category-only." The garment still exists and still appears in the closet; it
 * simply knows nothing about itself yet.
 */
export function categoryOnly(category: unknown = 'other'): ClampedUnderstanding {
  return clampUnderstanding({ category }).value;
}
