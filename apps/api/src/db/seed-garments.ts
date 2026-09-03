/**
 * Synthetic garment seeds.
 *
 * `docs/04-data/seed-data.md`: 220 garments is the size at which the product's
 * actual problem becomes visible. An empty Mira demonstrates nothing, and a
 * Mira with 12 garments demonstrates the wrong product.
 *
 * Everything here is SYNTHETIC. Production data is never copied into a lower
 * environment, and seed imagery is never taken from the reference screenshots.
 *
 * Deterministic: the same seed produces the same closet, so screenshots and
 * performance numbers are comparable between runs.
 */
import {
  CATEGORY_SUBCATEGORIES,
  COLORS,
  MATERIALS,
  OCCASIONS,
  PATTERNS,
  SEASONS,
  STYLE_TAGS,
  type Category,
} from '@mira/taxonomy';

/** Deterministic PRNG (mulberry32), so seeds are reproducible. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Category proportions matched to the primary persona, not to an even spread
 * (`docs/04-data/seed-data.md` — Composition).
 */
const COMPOSITION: Record<string, number> = {
  tops: 62,
  bottoms: 38,
  dresses: 31,
  shoes: 28,
  accessories: 18,
  outerwear: 16,
  bags: 14,
  activewear: 9,
  sets: 4,
};

const BRANDS = [
  'Aritzia',
  'Zara',
  'Fashion Nova',
  'H&M',
  'Nike',
  'SSENSE',
  'COS',
  'Reformation',
  'Everlane',
  'Mango',
  'Uniqlo',
  "Levi's",
  'Steve Madden',
  'Coach',
  'Lululemon',
  'Free People',
  'Madewell',
  'Anthropologie',
  'ASOS',
  'Urban Outfitters',
  'Sezane',
  'Ganni',
  'Vans',
  'Adidas',
];

/**
 * Brands deliberately left unresolved, so the `brand_raw`-without-`brand_id`
 * path is exercised in the UI (`docs/04-data/seed-data.md` — Composition).
 */
export const UNMATCHED_BRANDS = [
  'that little shop in lisbon',
  'vintage market',
  'thrifted',
  'unbranded',
  'gift',
  'handmade',
  'sample sale',
  'no label',
];

const SOURCE_TYPES = [
  'manual',
  'camera',
  'photo_library',
  'tag_scan',
  'barcode',
  'receipt',
  'email',
  'retailer_integration',
  'product_url',
  'order_screenshot',
];

const NAME_PARTS: Record<string, string[]> = {
  tops: ['Ribbed', 'Cropped', 'Oversized', 'Silk', 'Linen', 'Cowl Neck', 'Corset', 'Boxy'],
  bottoms: ['Wide-Leg', 'High-Rise', 'Straight', 'Pleated', 'Tailored', 'Barrel', 'Slim'],
  dresses: ['Satin', 'Slip', 'Wrap', 'Bodycon', 'Tiered', 'Halter', 'Sculpt'],
  outerwear: ['Wool', 'Quilted', 'Cropped', 'Longline', 'Suede', 'Shearling'],
  shoes: ['Pointed', 'Square-Toe', 'Platform', 'Kitten', 'Chunky', 'Strappy'],
  bags: ['Structured', 'Slouchy', 'Mini', 'Quilted', 'Woven'],
  accessories: ['Gold', 'Chunky', 'Delicate', 'Silk', 'Leather'],
  activewear: ['Seamless', 'High-Support', 'Compression', 'Lightweight'],
  sets: ['Matching', 'Knit', 'Tailored', 'Linen'],
};

export type SeedGarment = {
  name: string;
  brandRaw: string | null;
  category: string;
  subcategory: string | null;
  primaryColor: string;
  secondaryColors: string[];
  pattern: string;
  materials: string[];
  sizeRaw: string;
  sizeNormalized: string;
  sizeSystem: string;
  fit: string | null;
  season: string[];
  occasion: string[];
  styleTags: string[];
  purchaseDate: string | null;
  purchasePrice: number | null;
  currency: string | null;
  retailer: string | null;
  sourceType: string;
  status: string;
  favorite: boolean;
  tagsAttached: boolean | null;
  wornCount: number;
  lastWornDaysAgo: number | null;
  notes: string | null;
};

const pick = <T>(random: () => number, list: readonly T[]): T =>
  list[Math.floor(random() * list.length)] as T;

const pickSome = <T>(random: () => number, list: readonly T[], max: number): T[] => {
  const count = Math.floor(random() * (max + 1));
  const chosen = new Set<T>();
  for (let i = 0; i < count; i += 1) chosen.add(pick(random, list));
  return [...chosen];
};

const ALPHA_SIZES = ['XS', 'S', 'M', 'L'];
const SHOE_SIZES = ['6', '6.5', '7', '7.5', '8'];

/**
 * Build the `realistic` closet.
 *
 * The distribution deliberately includes the awkward cases that break screens:
 * never-worn pieces, tags still attached, long-forgotten garments, unavailable
 * statuses, and duplicates both genuine and merely similar.
 */
export function buildRealisticCloset(seed = 20260903): SeedGarment[] {
  const random = rng(seed);
  const garments: SeedGarment[] = [];

  for (const [category, count] of Object.entries(COMPOSITION)) {
    const subs = CATEGORY_SUBCATEGORIES[category as Category] ?? [];
    for (let i = 0; i < count; i += 1) {
      const isShoe = category === 'shoes';
      const useUnmatchedBrand = random() < 0.12;
      const subcategory = subs.length > 0 ? pick(random, subs) : null;
      const parts = NAME_PARTS[category] ?? ['Classic'];

      const hasPrice = random() > 0.15;
      const price = hasPrice ? Math.round((15 + random() * 240) * 100) / 100 : null;

      garments.push({
        name: `${pick(random, parts)} ${(subcategory ?? category).replace(/_/g, ' ')}`
          .replace(/\b\w/g, (c) => c.toUpperCase())
          .slice(0, 60),
        brandRaw: useUnmatchedBrand ? pick(random, UNMATCHED_BRANDS) : pick(random, BRANDS),
        category,
        subcategory,
        primaryColor: pick(random, COLORS),
        secondaryColors: random() < 0.25 ? [pick(random, COLORS)] : [],
        pattern: random() < 0.65 ? 'solid' : pick(random, PATTERNS),
        materials: pickSome(random, MATERIALS, 2),
        sizeRaw: isShoe ? pick(random, SHOE_SIZES) : pick(random, ALPHA_SIZES),
        sizeNormalized: isShoe ? pick(random, SHOE_SIZES) : pick(random, ALPHA_SIZES),
        sizeSystem: isShoe ? 'shoe_us' : 'alpha',
        fit: null,
        season: pickSome(random, SEASONS, 2),
        occasion: pickSome(random, OCCASIONS, 3),
        styleTags: pickSome(random, STYLE_TAGS, 2),
        purchaseDate: hasPrice
          ? new Date(Date.now() - Math.floor(random() * 900) * 86_400_000)
              .toISOString()
              .slice(0, 10)
          : null,
        purchasePrice: price,
        currency: price === null ? null : 'CAD',
        retailer: useUnmatchedBrand ? null : pick(random, BRANDS),
        sourceType: pick(random, SOURCE_TYPES),
        status: 'active',
        favorite: random() < 0.14,
        tagsAttached: null,
        wornCount: Math.floor(random() * 14),
        lastWornDaysAgo: Math.floor(random() * 200),
        notes: null,
      });
    }
  }

  // --- Deliberate edge cases, applied deterministically ---------------------
  const at = (index: number) => garments[index % garments.length] as SeedGarment;

  // 34 never worn.
  for (let i = 0; i < 34; i += 1) {
    const g = at(i * 6 + 1);
    g.wornCount = 0;
    g.lastWornDaysAgo = null;
  }

  // 11 still have their tags.
  for (let i = 0; i < 11; i += 1) {
    const g = at(i * 17 + 3);
    g.tagsAttached = true;
    g.wornCount = 0;
    g.lastWornDaysAgo = null;
  }

  // 19 forgotten for more than eight months.
  for (let i = 0; i < 19; i += 1) {
    const g = at(i * 11 + 5);
    if (g.wornCount === 0) g.wornCount = 1 + Math.floor(random() * 4);
    g.lastWornDaysAgo = 250 + Math.floor(random() * 200);
  }

  // Statuses that must be excluded from generated outfits (INV-2, D-012).
  for (let i = 0; i < 6; i += 1) at(i * 23 + 7).status = 'laundry';
  for (let i = 0; i < 3; i += 1) at(i * 29 + 9).status = 'archived';
  for (let i = 0; i < 2; i += 1) at(i * 31 + 11).status = 'lent_out';
  at(13).status = 'returned';

  // 3 genuine duplicates: the user really does own two of these.
  for (let i = 0; i < 3; i += 1) {
    const original = at(i * 37 + 2);
    garments.push({ ...original, favorite: false, wornCount: Math.floor(random() * 5) });
  }

  // 4 near-duplicate pairs: same brand and colour, different cut. These are the
  // hard cases for duplicate detection precision.
  for (let i = 0; i < 4; i += 1) {
    const original = at(i * 41 + 4);
    garments.push({
      ...original,
      name: `${original.name} Crew`,
      wornCount: Math.floor(random() * 5),
      favorite: false,
    });
  }

  return garments;
}

/** A deliberately awkward set, for state and error testing. */
export function buildEdgeCases(): SeedGarment[] {
  const base: SeedGarment = {
    name: 'Edge case',
    brandRaw: null,
    category: 'tops',
    subcategory: 't_shirt',
    primaryColor: 'black',
    secondaryColors: [],
    pattern: 'solid',
    materials: [],
    sizeRaw: 'M',
    sizeNormalized: 'M',
    sizeSystem: 'alpha',
    fit: null,
    season: [],
    occasion: [],
    styleTags: [],
    purchaseDate: null,
    purchasePrice: null,
    currency: null,
    retailer: null,
    sourceType: 'manual',
    status: 'active',
    favorite: false,
    tagsAttached: null,
    wornCount: 0,
    lastWornDaysAgo: null,
    notes: null,
  };

  return [
    { ...base, name: 'A'.repeat(90), notes: 'Very long product name' },
    { ...base, name: 'Emoji brand 🌸 and RTL עברית', brandRaw: 'شركة 🌸' },
    { ...base, purchasePrice: 0, currency: 'CAD', notes: 'Free' },
    { ...base, purchasePrice: 4200, currency: 'CAD', notes: 'Very expensive' },
    {
      ...base,
      secondaryColors: ['red', 'blue', 'green', 'gold', 'silver', 'pink'],
      materials: ['cotton', 'silk', 'wool', 'linen', 'denim'],
      notes: 'Many colours and materials',
    },
    { ...base, status: 'lost', notes: 'Lost garment' },
    { ...base, wornCount: 250, lastWornDaysAgo: 0, notes: 'Worn constantly' },
  ];
}
