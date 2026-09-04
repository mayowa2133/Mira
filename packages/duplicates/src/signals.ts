/**
 * The signals of `docs/06-ai/duplicate-detection.md` §2, and their strengths.
 */
import { SAME_IMAGE_MAX_DISTANCE, hammingDistance } from '@mira/imaging';
import {
  SAME_NAME_MIN_SIMILARITY,
  daysApart,
  diceSimilarity,
  nameTokens,
  normalizeBarcode,
  normalizeBrand,
  normalizeProductUrl,
  normalizeSize,
  normalizeSku,
} from './normalize.js';

/**
 * One garment, or one about to become a garment.
 *
 * `id` is absent for a candidate that has not been created yet, which is the
 * common case: detection runs BEFORE creation, from every ingestion path
 * (CAP-5).
 */
export type DuplicateSubject = {
  id?: string;
  name: string | null;
  brandId: string | null;
  brandRaw: string | null;
  category: string;
  primaryColor: string | null;
  sizeNormalized: string | null;
  sizeRaw: string | null;
  barcode: string | null;
  sku: string | null;
  retailer: string | null;
  productUrl: string | null;
  purchaseDate: string | null;
  sourceType: string;
  sourceReference: string | null;
  /** Perceptual hashes of every image on the garment. */
  imageHashes: readonly string[];
};

export type DuplicateSignal =
  | 'barcode'
  | 'sku_retailer'
  | 'product_url'
  | 'order_line'
  | 'image_hash'
  | 'brand_name'
  | 'category_color_size_brand'
  | 'purchase_window';

export type SignalStrength = 'decisive' | 'strong' | 'moderate' | 'weak';

export const SIGNAL_STRENGTH: Record<DuplicateSignal, SignalStrength> = {
  barcode: 'decisive',
  sku_retailer: 'decisive',
  product_url: 'decisive',
  order_line: 'decisive',
  image_hash: 'strong',
  brand_name: 'strong',
  category_color_size_brand: 'moderate',
  purchase_window: 'weak',
};

/**
 * Source types that carry an order line worth comparing.
 *
 * A `source_reference` on a manual entry or a camera capture is a local file or
 * a note, not an order — comparing those for equality would fire on two photos
 * that happened to share a name.
 */
const ORDER_BEARING = new Set(['receipt', 'email', 'retailer_integration', 'order_screenshot']);

/**
 * Purchases this far apart still support "the same thing, imported twice"
 * (§2, "Purchase dates within 3 days").
 */
export const PURCHASE_WINDOW_DAYS = 3;

const both = <T>(a: T | null, b: T | null): [T, T] | null =>
  a !== null && a !== undefined && b !== null && b !== undefined ? [a, b] : null;

/** Do these two refer to the same brand? Two unknown brands do not. */
export function sameBrand(a: DuplicateSubject, b: DuplicateSubject): boolean {
  const ids = both(a.brandId, b.brandId);
  if (ids) return ids[0] === ids[1];

  const raw = both(a.brandRaw, b.brandRaw);
  if (!raw) return false;

  const left = normalizeBrand(raw[0]);
  const right = normalizeBrand(raw[1]);
  return left.length > 0 && left === right;
}

/** The closest perceptual-hash pair across two garments, or null. */
export function closestImageDistance(a: DuplicateSubject, b: DuplicateSubject): number | null {
  let closest: number | null = null;
  for (const left of a.imageHashes) {
    for (const right of b.imageHashes) {
      const distance = hammingDistance(left, right);
      if (distance === null) continue;
      if (closest === null || distance < closest) closest = distance;
    }
  }
  return closest;
}

/**
 * Every signal that fires between two garments.
 *
 * Deliberately absent: **visual embedding similarity**. It is the one signal in
 * §2 that needs a model, it is documented there as "Never sufficient alone",
 * and the combination in `score.ts` is additive — so it drops in as one more
 * entry when Phase 5 produces embeddings, without moving any threshold.
 */
export function signalsBetween(a: DuplicateSubject, b: DuplicateSubject): DuplicateSignal[] {
  const signals: DuplicateSignal[] = [];

  const barcodes = both(a.barcode, b.barcode);
  if (barcodes && normalizeBarcode(barcodes[0]) === normalizeBarcode(barcodes[1])) {
    signals.push('barcode');
  }

  // "Same SKU + retailer" — a SKU is only unique within the retailer that
  // issued it, so a SKU match with an unknown retailer is not decisive.
  const skus = both(a.sku, b.sku);
  const retailers = both(a.retailer, b.retailer);
  if (
    skus &&
    retailers &&
    normalizeSku(skus[0]) === normalizeSku(skus[1]) &&
    normalizeBrand(retailers[0]) === normalizeBrand(retailers[1])
  ) {
    signals.push('sku_retailer');
  }

  const urls = both(a.productUrl, b.productUrl);
  if (urls) {
    const left = normalizeProductUrl(urls[0]);
    const right = normalizeProductUrl(urls[1]);
    if (left !== null && left === right) signals.push('product_url');
  }

  const references = both(a.sourceReference, b.sourceReference);
  if (
    references &&
    a.sourceType === b.sourceType &&
    ORDER_BEARING.has(a.sourceType) &&
    references[0] === references[1]
  ) {
    signals.push('order_line');
  }

  const distance = closestImageDistance(a, b);
  if (distance !== null && distance <= SAME_IMAGE_MAX_DISTANCE) signals.push('image_hash');

  const brandMatch = sameBrand(a, b);
  const names = both(a.name, b.name);
  if (brandMatch && names) {
    const similarity = diceSimilarity(
      nameTokens(names[0], a.brandRaw),
      nameTokens(names[1], b.brandRaw),
    );
    if (similarity >= SAME_NAME_MIN_SIMILARITY) signals.push('brand_name');
  }

  const colors = both(a.primaryColor, b.primaryColor);
  const sizeA = normalizeSize(a.sizeNormalized, a.sizeRaw);
  const sizeB = normalizeSize(b.sizeNormalized, b.sizeRaw);
  if (
    brandMatch &&
    colors &&
    colors[0] === colors[1] &&
    sizeA !== null &&
    sizeA === sizeB &&
    a.category === b.category
  ) {
    signals.push('category_color_size_brand');
  }

  const apart = daysApart(a.purchaseDate, b.purchaseDate);
  if (apart !== null && apart <= PURCHASE_WINDOW_DAYS) signals.push('purchase_window');

  return signals;
}

/**
 * Keys under which this garment could meet another one.
 *
 * Two garments can only fire a signal if they share at least one of these, so
 * grouping a closet by them turns "compare everything with everything" into a
 * handful of small groups. Derived from `signalsBetween` above rather than
 * written beside it, because a bucket that missed a signal would lose recall
 * silently — the tests hold the two in agreement.
 *
 * `purchase_window` has no key, deliberately: it is the one signal that cannot
 * surface anything on its own, so a pair sharing only a purchase date has
 * nothing to say.
 *
 * Image hashes are absent too. A near-match is not an equality, so it cannot be
 * a key — the caller pairs those up separately.
 */
export function bucketKeys(subject: DuplicateSubject): string[] {
  const keys: string[] = [];

  if (subject.barcode) keys.push(`barcode:${normalizeBarcode(subject.barcode)}`);
  if (subject.sku && subject.retailer) {
    keys.push(`sku:${normalizeSku(subject.sku)}@${normalizeBrand(subject.retailer)}`);
  }
  if (subject.productUrl) {
    const url = normalizeProductUrl(subject.productUrl);
    if (url) keys.push(`url:${url}`);
  }
  if (subject.sourceReference && ORDER_BEARING.has(subject.sourceType)) {
    keys.push(`order:${subject.sourceType}:${subject.sourceReference}`);
  }

  // Both remaining signals — `brand_name` and `category_color_size_brand` —
  // require the same brand, so one key covers them.
  if (subject.brandId) keys.push(`brand:${subject.brandId}`);
  else if (subject.brandRaw) keys.push(`brand:${normalizeBrand(subject.brandRaw)}`);

  return keys;
}

/**
 * Evidence AGAINST a pair.
 *
 * `signalsBetween` is deliberately one-directional — absent evidence is not
 * evidence of difference — and that was right for absence and wrong for
 * contradiction. A colour recorded on BOTH garments that disagrees is not
 * missing information; it is information, and it says these are two things.
 *
 * The evaluation set is what made this visible: every "same style, different
 * colour" and "same style, different size" pair scored 0.72 and asked, because
 * a matching brand and name fired while nothing could speak for the difference.
 * Owning a staple in three colours is ordinary, and being asked about it three
 * times is the interruption budget of §1 spent on nothing.
 *
 * Only colour and size. Category is NOT here: the same piece is legitimately
 * filed as `tops` on one path and `sets` on another, so a category
 * disagreement is as often a taxonomy artefact as a real difference.
 */
export type DuplicateConflict = 'primary_color' | 'size';

export function conflictsBetween(a: DuplicateSubject, b: DuplicateSubject): DuplicateConflict[] {
  const conflicts: DuplicateConflict[] = [];

  const colors = both(a.primaryColor, b.primaryColor);
  if (colors && colors[0] !== colors[1]) conflicts.push('primary_color');

  const sizeA = normalizeSize(a.sizeNormalized, a.sizeRaw);
  const sizeB = normalizeSize(b.sizeNormalized, b.sizeRaw);
  if (sizeA !== null && sizeB !== null && sizeA !== sizeB) conflicts.push('size');

  return conflicts;
}
