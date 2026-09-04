/**
 * Normalization used by duplicate signals (`docs/06-ai/duplicate-detection.md`
 * §2).
 *
 * Everything here is deterministic string work. A duplicate decision is one of
 * the few places where being wrong is expensive in both directions — a missed
 * duplicate fills the closet with the same dress three times, a false one may
 * merge two garments the user actually owns separately — so none of it guesses.
 */

/** Split a human string into comparable tokens. */
export function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length > 0);
}

/**
 * Sørensen–Dice over token sets.
 *
 * Chosen over exact equality because the spec's own example of "same normalized
 * name" is a pair that is not equal:
 *
 *   "Contour Bodysuit" vs "Contour Crew Bodysuit"  →  2·2/(2+3) = 0.8
 *
 * And over a character-level distance because the damaging near-miss is a
 * single *word*, not a single letter: "black midi dress" against "black mini
 * dress" is one character apart and a genuinely different garment. As tokens it
 * scores 0.667 and stays below the bar.
 */
export function diceSimilarity(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0;

  const left = new Set(a);
  const right = new Set(b);
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;

  return (2 * shared) / (left.size + right.size);
}

/**
 * The bar for "same normalized name".
 *
 * 0.8 is not a round number picked for comfort: it is exactly the score of the
 * pair `duplicate-detection.md` §4 uses to illustrate the signal, and it sits
 * above the 0.667 of the one-word-different case that must NOT fire.
 */
export const SAME_NAME_MIN_SIMILARITY = 0.8;

/**
 * Garment name tokens, with the brand removed.
 *
 * "Aritzia Contour Bodysuit" and "Contour Bodysuit" are the same garment
 * recorded by two ingestion paths — one that repeated the brand in the name and
 * one that did not. Comparing them raw scores 0.8 by luck on this example and
 * would fail on a two-word brand.
 *
 * If stripping leaves nothing — a garment named only after its brand — the
 * unstripped tokens are used, because an empty set silently scores 0 and would
 * read as "different".
 */
export function nameTokens(name: string, brand: string | null): string[] {
  const tokens = tokenize(name);
  if (!brand) return tokens;

  const brandTokens = new Set(tokenize(brand));
  const stripped = tokens.filter((token) => !brandTokens.has(token));
  return stripped.length > 0 ? stripped : tokens;
}

/**
 * Brand identity for comparison. Unrecognized brands live on as `brand_raw`.
 *
 * Tokens are joined with nothing rather than a space, because the difference
 * between "A.P.C." and "APC", or "Rag & Bone" and "ragbone", is punctuation and
 * spacing the user did not mean — nobody owns two brands that differ only there.
 */
export function normalizeBrand(value: string): string {
  return tokenize(value).join('');
}

/** Barcodes are transcribed with spaces and hyphens that carry no meaning. */
export function normalizeBarcode(value: string): string {
  return value.replace(/[\s-]+/g, '').toUpperCase();
}

/**
 * A SKU, however it was separated.
 *
 * Same reasoning as a barcode: "AB-1" off a tag and "ab1" off a product page
 * are one SKU written twice. This one is load-bearing — SKU + retailer is a
 * DECISIVE signal — but retailers do not issue both "AB-1" and "AB1" as
 * different products, while OCR and copy-paste vary the separator constantly.
 */
export function normalizeSku(value: string): string {
  return tokenize(value).join('').toUpperCase();
}

/**
 * Query parameters that identify the *visit*, not the product.
 *
 * Anything else is kept: plenty of retailers put the variant — the actual
 * identity of the garment — in a query parameter, so dropping them all would
 * merge a size 6 with a size 12.
 */
const TRACKING_PARAMS = [
  /^utm_/,
  /^gclid$/,
  /^fbclid$/,
  /^msclkid$/,
  /^mc_[ce]id$/,
  /^srsltid$/,
  /^_branch_match_id$/,
  /^ref$/,
  /^referrer$/,
  /^source$/,
];

/**
 * A product URL reduced to the product it points at.
 *
 * Returns null for anything unparseable rather than falling back to the raw
 * string: an unparseable URL compared by equality would make two malformed
 * values look decisive.
 */
export function normalizeProductUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const path = url.pathname.toLowerCase().replace(/\/+$/, '');

  const params = [...url.searchParams.entries()]
    .filter(([key]) => !TRACKING_PARAMS.some((pattern) => pattern.test(key.toLowerCase())))
    .map(([key, v]) => [key.toLowerCase(), v.toLowerCase()] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const query = params.map(([key, v]) => `${key}=${v}`).join('&');
  return `${host}${path}${query ? `?${query}` : ''}`;
}

/** A size, however it was written down. */
export function normalizeSize(normalized: string | null, raw: string | null): string | null {
  const value = normalized ?? raw;
  if (!value) return null;
  const cleaned = tokenize(value).join('');
  return cleaned.length > 0 ? cleaned : null;
}

/** Whole days between two ISO dates, or null if either is unusable. */
export function daysApart(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const left = Date.parse(a);
  const right = Date.parse(b);
  if (Number.isNaN(left) || Number.isNaN(right)) return null;
  return Math.abs(left - right) / 86_400_000;
}
